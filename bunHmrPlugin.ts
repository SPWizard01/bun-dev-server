import type { BunPlugin, Loader } from "bun";
import { bunHotReload } from "./bunClientHmr";
import { readFile } from "fs/promises";
import { type BunDevServerSocketConfig } from "./bunServeConfig";
export function getBunHMRPlugin(config: BunDevServerSocketConfig) {
    const bunHMRPlugin: BunPlugin = {
        name: "hmr",
        target: "browser",
        setup(build) {
            let hmrAdded = false;
            build.onLoad({ filter: /\.m?tsx?/ }, async (args) => {
                const contents = await readFile(args.path, { encoding: "utf-8" });
                const isTSx = /\.m?tsx$/.test(args.path);
                const isJSx = /\.m?jsx$/.test(args.path);
                const isJS = /\.m?js$/.test(args.path);
                const isTS = /\.m?ts$/.test(args.path);
                const loader: Loader = isTSx ? "tsx" : isJSx ? "jsx" : isTS ? "ts" : isJS ? "js" : "text";
                if (!hmrAdded) {
                    hmrAdded = true;
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

export function getBunHMRFooter(config: BunDevServerSocketConfig) {
    return `(${bunHotReload(config)})()`;
}