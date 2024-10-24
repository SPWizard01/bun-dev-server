/// <reference path="./@types/fileTypes.d.ts" />
import { render } from "ejs";
import Bun, { $, ShellError } from "bun";
import serveTemplate from "./serveOutputTemplate.ejs" with { type: "text" };
import indexTemplate from "./indexHTMLTemplate.ejs" with { type: "text" };
import { watch, readdir, exists, readFile } from "fs/promises";
import { type FileChangeInfo } from "fs/promises";
import { startTSWatcher } from "./bunTSWatcher";
import { getBunHMRFooter } from "./bunHmrPlugin";
import { type BunDevServerConfig } from "./bunServeConfig";
import { writeManifest } from "./bunManifest";



export async function startBunDevServer(serverConfig: BunDevServerConfig) {
  const defaultConfig = {
    port: 3000,
    websocketPath: "/hmr-ws",
    serveOutputEjs: serveTemplate,
    serveOutputHtml: indexTemplate
  }
  const finalConfig = { ...defaultConfig, ...serverConfig };
  const serveDestination = finalConfig.buildConfig.outdir ?? finalConfig.servePath ?? "dist";
  const bunDestinationPath = Bun.pathToFileURL(serveDestination);
  const dst = process.platform === "win32" ? bunDestinationPath.pathname.substring(1) : bunDestinationPath.pathname;
  try {
    await readdir(dst)
  } catch (e) {
    if ((e as ErrnoException).code === "ENOENT") {
      console.log("Directory not found, creating it...");
      await $`mkdir ${dst}`;
    } else {
      throw e;
    }
  }
  const buncfg = { port: finalConfig.port, tls: finalConfig.tls, websocketPath: finalConfig.websocketPath };
  const buildCfg: Bun.BuildConfig = {
    ...serverConfig.buildConfig,
    outdir: dst,
    plugins: [...(serverConfig.buildConfig.plugins ?? [])],
    footer: getBunHMRFooter(buncfg),
  }

  if (serverConfig.cleanServePath) {
    await cleanDirectory(dst);
  }
  console.log("Starting Bun Dev Server on port", finalConfig.port);
  const bunServer = Bun.serve({
    port: finalConfig.port,
    development: true,
    tls: finalConfig.tls,
    async fetch(req, server) {
      if (req.method === "OPTIONS") {
        const response = new Response("", { status: 200 });
        augumentHeaders(req, response);
        return response;
      }
      if (req.url.toLowerCase().endsWith("/favicon.ico")) {
        const response = new Response("", { status: 404 });
        augumentHeaders(req, response);
        return response;
      }
      if (req.url.toLowerCase().endsWith(finalConfig.websocketPath)) {
        if (server.upgrade(req)) {
          return;
        }
      }
      const url = new URL(req.url);
      const requestPath = url.pathname;
      const objThere = await exists(dst + requestPath);
      let isDirectory = false;
      if (objThere) {
        try {
          await readFile(dst + requestPath);
        } catch (e) {
          if ((e as ErrnoException).code === "EISDIR") {
            isDirectory = true;
          }
          else {
            throw e;
          }
        }
      } else {
        const response = new Response("", { status: 404 });
        augumentHeaders(req, response);
        return response;
      }

      if (!isDirectory) {
        try {
          const fl = Bun.file(dst + requestPath);
          const response = new Response(fl);
          augumentHeaders(req, response);
          return response;
        }
        catch (e) {
          if ((e as ErrnoException).code === "ENOENT") {
            const response = new Response("", { status: 404 });
            augumentHeaders(req, response);
            return response;
          }
          else {
            throw e;
          }
        }
      }
      try {
        const allEntries = await readdir(dst + requestPath, {
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
        const rnd = render(finalConfig.serveOutputEjs, { dirs, files });
        const response = new Response(rnd, { headers: { "Content-Type": "text/html" } });
        augumentHeaders(req, response);
        return response;
      } catch {
        const response = new Response("Not Found", { status: 404 });
        augumentHeaders(req, response);
        return response;
      }
    },


    websocket: {
      open(ws) {
        ws.subscribe("message");
      },
      message(ws, message) {
      },
      sendPings: true
    }
  });


  const output = await Bun.build(buildCfg);
  publishOutputLogs(output, { filename: "Initial", eventType: "change" });
  publishIndexHTML(output, { filename: "Initial", eventType: "change" });
  if (finalConfig.writeManifest) {
    writeManifest(output, dst, finalConfig.manifestName);
  }
  // $`tsc --watch`.then((tsc) => {
  //   console.log("ASDASD");
  // });

  if (finalConfig.enableTypeScriptWatch) {
    if (!finalConfig.watchDir) {
      throw new Error("watchDir must be set to enable TypeScript watch");
    }
    const watchDir = Bun.pathToFileURL(finalConfig.watchDir);
    startTSWatcher(bunServer, watchDir);
  }
  const watcher = watch("./src", { recursive: true });
  for await (const event of watcher) {
    if (finalConfig.cleanServePath) {
      await cleanDirectory(dst);
    }
    const output = await Bun.build(buildCfg);
    publishOutputLogs(output, event);
    publishIndexHTML(output, event);
    if (finalConfig.writeManifest) {
      writeManifest(output, dst, finalConfig.manifestName);
    }
    if (finalConfig.reloadOnChange) {
      bunServer.publish("message", JSON.stringify({ type: "reload" }));
    }

  }

  function publishOutputLogs(output: Bun.BuildOutput, event: FileChangeInfo<string>) {
    output.logs.forEach(console.log);
    bunServer.publish("message", JSON.stringify({ type: "message", message: `[Bun HMR] ${event.filename} ${event.eventType}` }));
    const outTable = output.outputs.filter(o => o.kind !== "sourcemap").map(o => {
      const a = Bun.pathToFileURL(o.path);
      const fileName = a.href.substring(a.href.lastIndexOf("/") + 1);
      return {
        name: fileName,
        path: o.path,
        size: convertBytes(o.size)
      };
    });
    console.table(outTable);
    bunServer.publish("message", JSON.stringify({ type: "output", message: outTable }));
  }

  function publishIndexHTML(output: Bun.BuildOutput, event: FileChangeInfo<string>) {
    const eps = output.outputs.filter(o => o.kind === "entry-point");
    const hashedImports: string[] = [];
    for (const ep of eps) {
      const basePathUrl = Bun.pathToFileURL(dst);
      const epUrl = Bun.pathToFileURL(ep.path);
      const hashedImport = `${epUrl.href.replace(basePathUrl.href, "")}?${ep.hash}`;
      hashedImports.push(hashedImport);
    }
    Bun.write(dst + "/index.html", render(finalConfig.serveOutputHtml, { hashedImports }));
  }

}

function augumentHeaders(request: Request, response: Response) {
  response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") ?? "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Credentials", "true");
}

async function cleanDirectory(dst: string) {
  const { stderr, exitCode } = await $`rm -rf ${dst}/*`.nothrow();
  if (exitCode !== 0) {
    if (stderr.indexOf("no matches found") > -1) {
      console.log("Directory is empty");
    } else {
      throw stderr;
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