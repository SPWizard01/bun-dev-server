/**
 * Build and notification management
 */
import { render } from "ejs";
import { build, type BuildConfig, type BuildOutput, type Server } from "bun";
import { type FileChangeInfo } from "fs/promises";
import pqueue from "p-queue";
import { type BunDevServerConfig } from "./bunServeConfig";
import { cleanDirectory, convertBytes } from "./utils/filesystem";
import { performTSC } from "./tsChecker";
import { writeManifest } from "./bunManifest";

/**
 * Create a throttled build queue to prevent excessive rebuilds
 * @param serverConfig - The server configuration
 * @returns A p-queue instance configured for throttled builds
 */
export function getThrottledBuildQueue(serverConfig: BunDevServerConfig): pqueue {
  return new pqueue({
    concurrency: 1,
    intervalCap: 1,
    interval: serverConfig.watchDelay ?? 1000,
    carryoverConcurrencyCount: true,
  });
}

/**
 * Build and notify clients about the build result
 * @param importerMeta - The ImportMeta object from the caller
 * @param finalConfig - The final server configuration
 * @param destinationPath - The absolute path to the output directory
 * @param buildCfg - The build configuration
 * @param bunServer - The Bun server instance
 * @param event - The file change event that triggered the build
 */
export async function cleanBuildAndNotify(
  importerMeta: ImportMeta,
  finalConfig: BunDevServerConfig,
  destinationPath: string,
  buildCfg: BuildConfig,
  bunServer: Server<any>,
  event: FileChangeInfo<string>
): Promise<void> {
  
  const buildEnv = {
    importerMeta,
    finalConfig,
    destinationPath,
    buildCfg,
    bunServer,
    event
  };
  
  await finalConfig.beforeBuild?.(buildEnv);
  
  try {
    const output = await build(buildCfg);
    publishOutputLogs(bunServer, output, finalConfig, event);
    
    if (finalConfig.createIndexHTML) {
      publishIndexHTML(destinationPath, finalConfig.serveIndexHtmlEjs!, output, event);
    }
    
    if (finalConfig.writeManifest) {
      writeManifest(output, destinationPath, finalConfig.manifestWithHash, finalConfig.manifestName);
    }
    
    await finalConfig.afterBuild?.(output, buildEnv);
    
    if (finalConfig.reloadOnChange && !finalConfig.waitForTSCSuccessBeforeReload) {
      bunServer.publish("message", JSON.stringify({ type: "reload" }));
    }
    
    const tscSuccess = await performTSC(finalConfig, importerMeta);
    
    if (finalConfig.reloadOnChange && finalConfig.waitForTSCSuccessBeforeReload && !tscSuccess.error) {
      bunServer.publish("message", JSON.stringify({ type: "reload" }));
    }
    
    if (tscSuccess.error && finalConfig.broadcastTSCErrorToClient) {
      bunServer.publish("message", JSON.stringify({ type: "tscerror", message: tscSuccess.message }));
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * Publish build output logs to console and clients
 * @param bunServer - The Bun server instance
 * @param output - The build output
 * @param config - The server configuration
 * @param event - The file change event that triggered the build
 */
function publishOutputLogs(
  bunServer: Server<any>,
  output: BuildOutput,
  config: BunDevServerConfig,
  event: FileChangeInfo<string>
): void {
  output.logs.forEach(console.log);
  bunServer.publish("message", JSON.stringify({ 
    type: "message", 
    message: `[Bun HMR] ${event.filename} ${event.eventType}` 
  }));
  
  const outTable = output.outputs.filter(o => o.kind !== "sourcemap").map(o => {
    const a = Bun.pathToFileURL(o.path);
    const distPath = Bun.pathToFileURL(config.buildConfig.outdir ?? "./dist");
    const distPathHref = distPath.href;
    const lastDistIdx = distPathHref.lastIndexOf("/") + 1;
    const fileName = a.href.substring(a.href.lastIndexOf("/") + 1);
    const fileWithPath = a.href.substring(lastDistIdx);
    return {
      name: fileName,
      path: fileWithPath,
      size: convertBytes(o.size)
    };
  });
  
  if (config.broadcastBuildOutputToConsole) {
    console.table(outTable);
  }
  
  if (config.broadcastBuildOutputToClient) {
    bunServer.publish("message", JSON.stringify({ type: "output", message: outTable }));
  }
}

/**
 * Generate and write index.html file based on build output
 * @param destinationPath - The absolute path to the output directory
 * @param template - The EJS template string
 * @param output - The build output
 * @param _event - The file change event (unused, kept for consistency)
 */
function publishIndexHTML(
  destinationPath: string,
  template: string,
  output: BuildOutput,
  _event: FileChangeInfo<string>
): void {
  const eps = output.outputs.filter(o => o.kind === "entry-point");
  const hashedImports: string[] = [];
  
  for (const ep of eps) {
    const basePathUrl = Bun.pathToFileURL(destinationPath);
    const epUrl = Bun.pathToFileURL(ep.path);
    const hashedImport = `${epUrl.href.replace(basePathUrl.href, "")}?${ep.hash}`;
    hashedImports.push(hashedImport);
  }
  
  Bun.write(destinationPath + "/index.html", render(template, { hashedImports }));
}
