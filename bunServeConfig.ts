import { type BuildConfig, type TLSOptions } from "bun";

export interface BunDevServerConfig extends Partial<BunDevServerSocketConfig> {
    port: number;
    buildConfig: BuildConfig;
    watchDir?: string;
    enableTypeScriptWatch?: boolean;
    writeManifest?: boolean;
    manifestName?: string;
    manifestWithHash?: boolean;
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
    websocketPath: string;
}