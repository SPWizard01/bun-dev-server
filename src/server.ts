import { $, type BuildConfig, type ServerWebSocket } from "bun";
import serveTemplate from "./serveOutputTemplate.ejs" with { type: "text" };
import indexTemplate from "./indexHTMLTemplate.ejs" with { type: "text" };
import { watch, readdir } from "fs/promises";
import { resolve } from "path";
import { bunHotReloadPlugin, getBunHMRFooter } from "./bunHmrPlugin";
import { type BunDevServerConfig } from "./bunServeConfig";
import { DEFAULT_HMR_PATH } from "./bunClientHmr";
import { cleanBuildAndNotify, getThrottledBuildQueue } from "./buildManager";
import { handlePathRequest } from "./httpHandler";
import { staticAssetRoutes } from "./staticAssets";
import { withCORSHeaders } from "./utils/cors";
import { cleanDirectory } from "./utils/filesystem";


export async function startBunDevServer(serverConfig: BunDevServerConfig, importMeta: ImportMeta) {
  const defaultConfig: Partial<BunDevServerConfig> = {
    port: 3000,
    websocketPath: DEFAULT_HMR_PATH,
    serveOutputEjs: serveTemplate,
    serveIndexHtmlEjs: indexTemplate,
    createIndexHTML: true,
    tscConfigPath: resolve(importMeta.dir, "./tsconfig.json"),
    broadcastBuildOutputToConsole: true,
    broadcastBuildOutputToClient: true
  }

  const finalConfig: BunDevServerConfig = { ...defaultConfig, ...serverConfig };
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
      ...staticAssetRoutes,
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
  const queue = getThrottledBuildQueue(finalConfig);
  await queue.add(async () => {
    await cleanBuildAndNotify(importMeta, finalConfig, destinationPath, buildCfg, bunServer, { filename: "Initial", eventType: "change" });
  })
  // await debouncedbuildAndNotify(importMeta, finalConfig, destinationPath, buildCfg, bunServer, { filename: "Initial", eventType: "change" });
  const watcher = watch(srcWatch, { recursive: true });

  for await (const event of watcher) {
    if (queue.pending > 0) {
      continue;
    }
    try {
      if (queue.size > 0) {
        queue.clear();
      }
      queue.add(async () => {
        await cleanBuildAndNotify(importMeta, finalConfig, destinationPath, buildCfg, bunServer, event);
      })
    }
    catch (e) {
      console.error("Error while processing file change", e);
    }
  }
}
