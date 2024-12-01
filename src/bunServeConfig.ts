import { type BuildConfig, type TLSOptions } from "bun";

export interface BunDevServerConfig extends Partial<BunDevServerSocketConfig> {
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
    writeManifest?: boolean;
    manifestName?: string;
    manifestWithHash?: boolean;
    hotReload?: "plugin" | "footer";
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
}

export interface BunDevServerSocketConfig {
    port: number;
    tls?: TLSOptions;
    websocketPath?: string;
}