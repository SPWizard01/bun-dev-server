import { type ServerWebSocket } from "bun";
import { type BunDevServerConfig } from "./bunServeConfig";
import { handlePathRequest } from "./httpHandler";
import { staticAssetRoutes } from "./staticAssets";
import { withCORSHeaders } from "./utils/cors";
import { startFileWatcher } from "./fileWatcher";
import { prepareConfiguration } from "./configManager";


export async function startBunDevServer(serverConfig: BunDevServerConfig, importMeta: ImportMeta) {
  // Prepare and validate configuration
  const { finalConfig, destinationPath, srcWatch, buildCfg } = await prepareConfiguration(serverConfig, importMeta);

  console.log("🚀 Starting Bun Dev Server on port", finalConfig.port);
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

  // Start file watcher with initial build
  await startFileWatcher(srcWatch, importMeta, finalConfig, destinationPath, buildCfg, bunServer);
}
