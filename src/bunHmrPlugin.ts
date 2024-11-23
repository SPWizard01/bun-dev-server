import type { BunPlugin, Loader } from "bun";
import { bunHotReload } from "./bunClientHmr";
import { readFile } from "fs/promises";

export interface BunHMROptions {
    secure?: boolean;
    port: number;
    websocketPath?: string;
  }

export function bunHotReloadPlugin(config: BunHMROptions) {
    const bunHMRPlugin: BunPlugin = {
        name: "hmr",
        target: "browser",
        setup(build) {
            const entryPoints: string[] = [];
            const addedEnryPoints = new Set<string>();
            build.config.entrypoints.forEach(entry => {
                let entryPath = entry.replace(/^\.*/, "");
                if (process.platform === "win32") {
                    entryPath = entryPath.replace(/\//g, "\\");
                }
                entryPoints.push(entryPath);
            })
            build.onLoad({ filter: /\.m?tsx?/ }, async (args) => {
                const contents = await readFile(args.path, { encoding: "utf-8" });
                const isTSx = /\.m?tsx$/.test(args.path);
                const isJSx = /\.m?jsx$/.test(args.path);
                const isJS = /\.m?js$/.test(args.path);
                const isTS = /\.m?ts$/.test(args.path);
                const loader: Loader = isTSx ? "tsx" : isJSx ? "jsx" : isTS ? "ts" : isJS ? "js" : "text";
                const isEntry = entryPoints.some(entry => args.path.endsWith(entry))
                if (!addedEnryPoints.has(args.path) && isEntry) {
                    addedEnryPoints.add(args.path);
                    return { contents: `import "bun-hot-reload"\n` + contents, loader };
                }
                return { contents, loader };
            });
            build.onLoad({ filter: /./, namespace: "bun-hot-reload" }, async (args) => {

                return { contents: `(${bunHotReload(config)})()\n`, loader: "ts" };
            });
            build.onResolve({ filter: /^bun-hot-reload$/ }, (args) => {
                return { path: args.path, namespace: "bun-hot-reload" };
            })
        },
    }
    return bunHMRPlugin;
}

export function getBunHMRFooter(config: BunHMROptions) {
    return `;(${bunHotReload(config)})();`;
}