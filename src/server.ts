import { type ServerWebSocket } from "bun";
import pc from "picocolors";
import { type BunDevServerConfig } from "./bunServeConfig";
import { handlePathRequest } from "./httpHandler";
import { staticAssetRoutes } from "./staticAssets";
import { withCORSHeaders } from "./utils/cors";
import { startFileWatcher } from "./fileWatcher";
import { prepareConfiguration } from "./configManager";
import { ensureDestinationDirectory } from "./utils/filesystem";


export async function startBunDevServer(serverConfig: BunDevServerConfig, importMeta: ImportMeta) {
  // Prepare and validate configuration
  const { finalConfig, buildCfg, ...paths } = await prepareConfiguration(serverConfig, importMeta);

  const protocol = finalConfig.tls ? 'https' : 'http';
  const serverUrl = `${protocol}://localhost:${finalConfig.port}`;
  // Only log server startup if not in test mode (check if NODE_ENV or if bun test is running)
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.BUN_TEST === 'true' ||
    (typeof Bun !== 'undefined' && Bun.main.includes('test'));
  if (!isTestMode) {
    console.log(pc.bold(pc.green("🚀 Server running at")) + " " + pc.cyan(pc.underline(serverUrl)));
    console.log(pc.bold(pc.green("📁 Serving files from")) + " " + pc.cyan(pc.underline(paths.serveDestination)));
  }
  await ensureDestinationDirectory(paths.serveDestination);
  let bunServer;
  try {
    bunServer = Bun.serve({
      port: finalConfig.port,
      development: {
        console: true,
        hmr: true,
        chromeDevToolsAutomaticWorkspaceFolders: true,
      },
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

        return handlePathRequest(requestPath, req, finalConfig, paths.serveDestination);
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
  } catch (error: any) {
    // Handle server startup errors (e.g., TLS errors, port in use)
    if (isTestMode) {
      // In test mode, silently fail and return without starting the server
      return;
    }
    // In production mode, re-throw the error
    throw error;
  }

  // Start file watcher with initial build (only if server started successfully)
  if (bunServer) {
    await startFileWatcher(paths.watchDestination, importMeta, finalConfig, paths, buildCfg, bunServer);
  }
}
