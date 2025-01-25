import { type BuildConfig, type TLSOptions } from "bun";

export interface BunDevServerConfig extends Partial<BunServeConfig> {
    port: number;
    buildConfig: BuildConfig;
    watchDir: string;
    /**
     * The delay in milliseconds to wait before starting a new build once a file has changed.
     * Used in debounce function, in case many changes happen in file system at once
     * @default 1000
     */
    watchDelay?: number;
    //enableTypeScriptWatch?: boolean;
    enableTSC?: boolean;
    /**
     * The path to the TypeScript configuration file.
     * Defaults to "./tsconfig.json".
     */
    tscConfigPath?: string;
    writeManifest?: boolean;
    manifestName?: string;
    manifestWithHash?: boolean;
    hotReload?: "plugin" | "footer";
    logRequests?: boolean;
    reloadOnChange?: boolean;
    /**
     * The path to the directory to serve files from.
     * Takes precedence over `buildConfig.outdir`.
     * Defaults to "dist".
    */
    servePath?: string;
    cleanServePath?: boolean;
    serveOutputEjs?: string;
    serveOutputHtml?: string;
    /**
     * Using EJS Index HTML template.
     * Defaults to true.
     */
    createDefaultIndexHTML?: boolean;
}

export interface BunServeConfig {
    port: number;
    tls?: TLSOptions;
    websocketPath?: string;
    static?: Record<`/${string}`, Response>;
}