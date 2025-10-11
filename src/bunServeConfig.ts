import { type BuildConfig, type TLSOptions, type Server, type BuildOutput } from "bun";
import type { FileChangeInfo } from "fs/promises";

export interface BuildEnv {
    importerMeta: ImportMeta;
    finalConfig: BunDevServerConfig;
    destinationPath: string;
    buildCfg: BuildConfig;
    bunServer: Server<any>;
    event: FileChangeInfo<any>
}

export interface BunDevServerConfig extends Partial<BunServeConfig> {
    /**
     * The port to run the server on.
     */
    port: number;
    /**
     * The build configuration to use for the server.
     */
    buildConfig: BuildConfig;
    /**
     * The directory to watch for changes.
     */
    watchDir: string;
    /**
     * The delay in milliseconds to wait before starting a new build once a file has changed.
     * Used in debounce function, in case many changes happen in file system at once.
     * @default 1000
     */
    watchDelay?: number;
    /**
     * Whether to enable TypeScript checking it will use `tscConfigPath` in your project directory.
     * @default false
     */
    enableTSC?: boolean;
    /**
     * Whether to broadcast the TypeScript check error to the client.
     * @default false
     */
    broadcastTSCErrorToClient?: boolean;
    /**
     * The path to the TypeScript configuration file.
     * @default "./tsconfig.json".
     */
    tscConfigPath?: string;
    /**
     * Whether to write the manifest file.
     * @default false
     */
    writeManifest?: boolean;
    /**
     * The name of the manifest file.
     * @default "bun_server_manifest.json"
     */
    manifestName?: string;
    /**
     * Whether to include the hash with the entrypoints in the manifest file.
     * @default false
     */
    manifestWithHash?: boolean;
    /**
     * Where to place hot reload script.
     * @default "none"
     */
    hotReload?: "plugin" | "footer" | "none";
    /**
     * Whether to wait for the TypeScript check to finish before reloading the page.
     * @default false
     */
    waitForTSCSuccessBeforeReload?: boolean;
    /**
     * Whether to broadcast the build output to the browser.
     * @default true
     */
    broadcastBuildOutputToClient?: boolean;
    /**
     * Whether to broadcast the build output to the console.
     * @default true
     */
    broadcastBuildOutputToConsole?: boolean;
    /**
     * Whether to reload the page when a file changes.
     * This requires property `hotReload` to be set to `"plugin"` or `"footer"`.
     * @default false
     */
    reloadOnChange?: boolean;
    /**
     * Whether to log HTTP requests to the console.
     * @default false
     */
    logRequests?: boolean;
    /**
     * The path to the directory to serve files from.
     * Takes precedence over `buildConfig.outdir`.
     * @default `buildConfig.outdir`.
    */
    servePath?: string;
    /**
     * Whether to clean the `servePath` before building a new batch.
     */
    cleanServePath?: boolean;
    /**
     * The EJS template used for the output of the `/` path on the server.
     * When supplying your own template, the properties that are provided during rendering are `files` and `dirs` both are arrays.
     */
    serveOutputEjs?: string;
    /**
     * The EJS template used for the output of the `/index.html` path on the server.
     * When supplying your own template, the property that is provided during rendering is `hashedImports` that is an array of strings.
     */
    serveIndexHtmlEjs?: string;
    /**
     * Whether to create index.html using `serveIndexHtmlEjs` template.
     * @default true.
     */
    createIndexHTML?: boolean;
    /**
     * Event listener to execute before Bun builds
     * @param env Supplied environment for the build
     */
    beforeBuild?: (env: BuildEnv) => Promise<void> | void;
    /**
    * Event listener to execute after Bun builds
    * @param output The output of the build
    * @param env Supplied environment for the build
    */
    afterBuild?: (output: BuildOutput, env: BuildEnv) => Promise<void> | void;
}

export interface BunServeConfig {
    port: number;
    /**
     * Secure options for the server.
     */
    tls?: TLSOptions;
    /**
     * The websocket path to use for the server.
     * @default "/hmr-ws".
     */
    websocketPath?: string;
    /**
     * Static bun responses
     */
    routes?: Record<`/${string}`, Response>;
}