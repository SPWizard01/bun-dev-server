/**
 * File system watcher management
 */
import { watch } from "fs/promises";
import { type BuildConfig, type Server } from "bun";
import { type BunDevServerConfig } from "./bunServeConfig";
import { cleanBuildAndNotify, getThrottledBuildQueue } from "./buildManager";

/**
 * Start watching a directory for changes and trigger builds
 * @param srcWatch - The absolute path to watch for changes
 * @param importMeta - The ImportMeta object from the caller
 * @param finalConfig - The final server configuration
 * @param destinationPath - The absolute path to the output directory
 * @param buildCfg - The build configuration
 * @param bunServer - The Bun server instance
 */
export async function startFileWatcher(
  srcWatch: string,
  importMeta: ImportMeta,
  finalConfig: BunDevServerConfig,
  destinationPath: string,
  buildCfg: BuildConfig,
  bunServer: Server<any>
): Promise<void> {
  // Create throttled build queue and perform initial build
  const queue = getThrottledBuildQueue(finalConfig);
  await queue.add(async () => {
    await cleanBuildAndNotify(importMeta, finalConfig, destinationPath, buildCfg, bunServer, { filename: "Initial", eventType: "change" });
  });

  // Start watching for file changes
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
      });
    } catch (e) {
      console.error("Error while processing file change", e);
    }
  }
}
