import { render } from "ejs";
import { $, type BuildConfig, type BuildOutput, type Server, type ServerWebSocket } from "bun";
import serveTemplate from "./serveOutputTemplate.ejs" with { type: "text" };
import indexTemplate from "./indexHTMLTemplate.ejs" with { type: "text" };
import { watch, readdir, access, readFile, constants } from "fs/promises";
import { type FileChangeInfo } from "fs/promises";
import { resolve } from "path"
import { bunHotReloadPlugin, getBunHMRFooter } from "./bunHmrPlugin";
import { type BunDevServerConfig } from "./bunServeConfig";
import { writeManifest } from "./bunManifest";
import { performTSC } from "./tsChecker";
import { DEFAULT_HMR_PATH } from "./bunClientHmr";
import debounce from "debounce"
let watchDelay = 1000;

export async function startBunDevServer(serverConfig: BunDevServerConfig, importMeta: ImportMeta) {
  const defaultConfig: Partial<BunDevServerConfig> = {
    port: 3000,
    websocketPath: DEFAULT_HMR_PATH,
    serveOutputEjs: serveTemplate,
    serveIndexHtmlEjs: indexTemplate,
    createIndexHTML: true,
    tscConfigPath: resolve(importMeta.dir, "./tsconfig.json"),
    broadcastBuildOutputToConsole: true,
    broadcastBuildOutputToClient: true,
  }

  const finalConfig: BunDevServerConfig = { ...defaultConfig, ...serverConfig };
  if (finalConfig.watchDelay) {
    watchDelay = finalConfig.watchDelay;
  }
  if (serverConfig.tscConfigPath) {
    finalConfig.tscConfigPath = resolve(importMeta.dir, serverConfig.tscConfigPath);
  }
  if (!finalConfig.watchDir) {
    throw new Error("watchDir must be set");
  }
  const servePart = finalConfig.buildConfig.outdir ?? finalConfig.servePath ?? "./dist";

  const serveDestination = resolve(importMeta.dir, servePart);
  const watchDestination = resolve(importMeta.dir, finalConfig.watchDir);

  const allEntries = serverConfig.buildConfig.entrypoints.splice(0, serverConfig.buildConfig.entrypoints.length);
  const resolvedEntries = allEntries.map(e => resolve(importMeta.dir, e));
  serverConfig.buildConfig.entrypoints = resolvedEntries;
  // const bunDestinationPath = Bun.pathToFileURL(serveDestination);
  // const bunWatchDirPath = Bun.pathToFileURL(watchDestination);
  // const destinationPath = process.platform === "win32" ? bunDestinationPath.pathname.substring(1) : bunDestinationPath.pathname;
  // const srcWatch = process.platform === "win32" ? bunWatchDirPath.pathname.substring(1) : bunWatchDirPath.pathname;

  const destinationPath = serveDestination;
  const srcWatch = watchDestination;
  try {
    await readdir(destinationPath)
  } catch (e) {
    if ((e as ErrnoException).code === "ENOENT") {
      console.log("Directory not found, creating it...");
      try {
        await $`mkdir ${destinationPath}`;
      }
      catch (e) {
        console.error("Unable to create directory", e);
      }
    } else {
      throw e;
    }
  }
  const buncfg = { port: finalConfig.port, tls: finalConfig.tls, websocketPath: finalConfig.websocketPath, secure: finalConfig.tls !== undefined };
  const buildCfg: BuildConfig = {
    ...serverConfig.buildConfig,
    outdir: destinationPath
  }

  if (finalConfig.hotReload === "footer") {
    if (!buildCfg.footer) {
      buildCfg.footer = "";
    }
    buildCfg.footer += getBunHMRFooter(buncfg);
  }
  if (finalConfig.hotReload === "plugin") {
    if (!buildCfg.plugins) {
      buildCfg.plugins = [];
    }
    buildCfg.plugins.push(bunHotReloadPlugin(buncfg));
  }

  if (serverConfig.cleanServePath) {
    await cleanDirectory(destinationPath);
  }

  console.log("Starting Bun Dev Server on port", finalConfig.port);
  const bunServer = Bun.serve({
    port: finalConfig.port,
    development: true,
    tls: finalConfig.tls,
    routes: {
      "/favicon.ico": withCORSHeaders(new Response("", { status: 404 })),
      ...finalConfig.routes,
    },

    async fetch(req, server) {
      if (req.method === "OPTIONS") {
        finalConfig.logRequests && console.log(`${200} ${req.url} OPTIONS`);
        return withCORSHeaders(new Response("", { status: 200 }), req);
      }
      if (req.url.toLowerCase().endsWith(finalConfig.websocketPath!)) {
        finalConfig.logRequests && console.log(`${req.url} Socket Upgrade`);
        if (server.upgrade(req)) {
          return withCORSHeaders(new Response("", { status: 200 }), req);
        }
      }
      const url = new URL(req.url);
      let requestPath = url.pathname;

      return handlePathRequest(requestPath, req, finalConfig, destinationPath);
    },


    websocket: {
      open(ws: ServerWebSocket) {
        ws.subscribe("message");
      },
      message(ws: ServerWebSocket, message: string | Buffer) {
      },
      sendPings: true,

    }
  });

  debouncedbuildAndNotify(importMeta, finalConfig, destinationPath, buildCfg, bunServer, { filename: "Initial", eventType: "change" });
  const watcher = watch(srcWatch, { recursive: true });
  for await (const event of watcher) {
    debouncedbuildAndNotify(importMeta, finalConfig, destinationPath, buildCfg, bunServer, event);
  }
}


const debouncedbuildAndNotify = debounce(async (importerMeta: ImportMeta, finalConfig: BunDevServerConfig, destinationPath: string, buildCfg: BuildConfig, bunServer: Server, event: FileChangeInfo<string>) => {
  if (finalConfig.cleanServePath) {
    await cleanDirectory(destinationPath);
  }
  const buildEnv = {
    importerMeta,
    finalConfig,
    destinationPath,
    buildCfg,
    bunServer,
    event
  }
  finalConfig.beforeBuild?.(buildEnv);
  try {
    const output = await Bun.build(buildCfg);
    publishOutputLogs(bunServer, output, finalConfig, event);
    if (finalConfig.createIndexHTML) {
      publishIndexHTML(destinationPath, finalConfig.serveIndexHtmlEjs!, output, event);
    }
    if (finalConfig.writeManifest) {
      writeManifest(output, destinationPath, finalConfig.manifestWithHash, finalConfig.manifestName);
    }
    finalConfig.afterBuild?.(output, buildEnv);
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

  }
  catch (e) {
    console.error(e);
  }
}, watchDelay, { immediate: true });

function handleErrorResponse(req: Request, err: unknown) {
  const msg = `Error while processing request ${req.url}`;
  console.error(msg, err);
  return withCORSHeaders(new Response(msg, { status: 500 }), req);
}

function publishOutputLogs(bunServer: Server, output: BuildOutput, config: BunDevServerConfig, event: FileChangeInfo<string>) {
  output.logs.forEach(console.log);
  bunServer.publish("message", JSON.stringify({ type: "message", message: `[Bun HMR] ${event.filename} ${event.eventType}` }));
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

function publishIndexHTML(destinationPath: string, template: string, output: BuildOutput, _event: FileChangeInfo<string>) {
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

function withCORSHeaders(response: Response, request?: Request) {
  response.headers.set("Access-Control-Allow-Origin", request?.headers.get("origin") ?? "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

async function cleanDirectory(dst: string) {
  const { stderr, exitCode } = await $`rm -rf ${dst}/*`.nothrow();
  if (exitCode !== 0) {
    if (stderr.indexOf("no matches found") > -1) {
      console.log("Directory is empty");
    } else {
      console.warn("Unable to clean directory", stderr.toString("utf8"));
    }
  }
}

function convertBytes(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  if (bytes == 0) {
    return "n/a"
  }
  const floored = Math.floor(Math.log(bytes) / Math.log(1024));
  // console.log(floored);
  // console.log(parseInt(`${floored}`));
  const i = floored;

  if (i == 0) {
    return bytes + " " + sizes[i]
  }

  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i]
}

async function handlePathRequest(requestPath: string, req: Request, finalConfig: BunDevServerConfig, destinationPath: string) {
  let fsPath = destinationPath + requestPath;
  const objThere = await checkObjectExists(fsPath, req);
  let isDirectory = false;
  if (objThere) {
    try {
      await readFile(fsPath);
    } catch (e) {
      if ((e as ErrnoException).code === "EISDIR") {
        isDirectory = true;
      }
      else {
        throw e;
      }
    }
  } else {
    if (requestPath.toLowerCase() !== "/index.html") {
      finalConfig.logRequests && console.log(`${404} ${req.url}`);
      return withCORSHeaders(new Response("", { status: 404 }), req);
    }
    requestPath = "/";
    isDirectory = true;
    fsPath = destinationPath + requestPath
  }

  if (!isDirectory) {
    try {
      const fl = Bun.file(fsPath);
      finalConfig.logRequests && console.log(`${200} ${req.url}`);
      return withCORSHeaders(new Response(fl), req);;
    }
    catch (e) {
      if ((e as ErrnoException)?.code === "ENOENT") {
        finalConfig.logRequests && console.log(`${404} ${req.url}`);
        return withCORSHeaders(new Response("", { status: 404 }), req);;
      }
      else {
        return handleErrorResponse(req, e);
      }
    }
  }
  try {
    const allEntries = await readdir(fsPath, {
      withFileTypes: true,
    });
    const dirs = allEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        return {
          requestPath: requestPath === "/" ? "" : requestPath,
          name: entry.name,
        };
      });
    const files = allEntries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        return {
          requestPath: requestPath === "/" ? "" : requestPath,
          name: entry.name,
        };
      });
    const rnd = render(finalConfig.serveOutputEjs!, { dirs, files });
    finalConfig.logRequests && console.log(`${200} ${req.url}`);
    return withCORSHeaders(new Response(rnd, { headers: { "Content-Type": "text/html" } }), req);;
  } catch (err) {
    return handleErrorResponse(req, err);
  }
}

async function checkObjectExists(fsPath: string, req: Request) {
  try {
    await access(fsPath, constants.R_OK);
    return true;
  }
  catch (e) {
    if ((e as ErrnoException)?.code === "ENOENT") {
      return false;
    }
    const msg = `Error while accessing path ${fsPath}`;
    console.error(msg, e);
    return false;
  }

}
