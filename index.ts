/// <reference path="./@types/serve.ts" />
import { render } from "ejs";
import Bun, { $ } from "bun";
import serveTemplate from "./serveOutputTemplate.ejs" with { type: "text" };
import indexTemplate from "./indexHTMLTemplate.ejs" with { type: "text" };
import { watch, readdir, exists, readFile } from "fs/promises";
import { type FileChangeInfo } from "fs/promises";
import { startTSWatcher } from "./bunTSWatcher";
import { getBunHMRPlugin } from "./bunHmrPlugin";
import { type BunDevServerConfig } from "./bunServeConfig";


export async function startBunDevServer(serverConfig: BunDevServerConfig) {
  const defaultConfig = {
    port: 3000,
    websocketPath: "/hmr-ws",
    serveOutputEjs: serveTemplate,
    serveOutputHtml: indexTemplate
  }
  const finalConfig = { ...defaultConfig, ...serverConfig };
  const dsts = Bun.pathToFileURL(serverConfig.destingationPath);
  const dst = process.platform === "win32" ? dsts.pathname.substring(1) : dsts.pathname;
  console.log(dst);
  const buildCfg: Bun.BuildConfig = {
    ...serverConfig.buildConfig,
    outdir: dst,
    plugins: [...serverConfig.buildConfig.plugins ?? [], getBunHMRPlugin({ port: finalConfig.port, tls: finalConfig.tls, websocketPath: finalConfig.websocketPath })]
  }

  const bunServer = Bun.serve({
    port: finalConfig.port,
    development: true,
    tls: finalConfig.tls,
    async fetch(req, server) {
      if (req.url.toLowerCase().endsWith("/favicon.ico")) {
        return new Response("", { status: 404 });
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
          } else {
            throw e;
          }
        }
      }

      if (!isDirectory) {
        const fl = Bun.file(dst + requestPath);
        return new Response(fl);
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
        return new Response(rnd, { headers: { "Content-Type": "text/html" } });
      } catch {
        return new Response("Not Found", { status: 404 });
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
  if (serverConfig.cleanDestination) {
    await $`rm -rf ${dst}/*`;
  }
  const output = await Bun.build(buildCfg);
  publishOutputLogs(output, { filename: "Initial", eventType: "change" });
  publishIndexHTML(output, { filename: "Initial", eventType: "change" });
  // $`tsc --watch`.then((tsc) => {
  //   console.log("ASDASD");
  // });

  if (serverConfig.enableTypeScriptWatch) {
    startTSWatcher(bunServer);
  }
  const watcher = watch("./src", { recursive: true });
  for await (const event of watcher) {
    if (serverConfig.cleanDestination) {
      await $`rm -rf ${dst}/*`;
    }
    const output = await Bun.build(buildCfg);
    publishOutputLogs(output, event);
    publishIndexHTML(output, event);
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
    const ep = output.outputs.find(o => o.kind === "entry-point");
    if (ep) {
      const basePathUrl = Bun.pathToFileURL(dst);
      const epUrl = Bun.pathToFileURL(ep.path);
      const hashedImport = `${epUrl.href.replace(basePathUrl.href, "")}?${ep.hash}`;
      Bun.write(dst + "/index.html", render(finalConfig.serveOutputHtml, { hashedImport }));
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

startBunDevServer({
  port: 3000,
  cleanDestination: true,
  destingationPath: "dist",
  enableTypeScriptWatch: true,
  buildConfig: {
    entrypoints: ["./src/app.ts"],
    // publicPath: "/",
    target: "browser",
    plugins: [],
    sourcemap: "linked",
    splitting: true,
    loader: {
      ".svg": "file"
    }
  }
})