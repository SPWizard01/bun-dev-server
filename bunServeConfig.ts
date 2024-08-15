import { type BuildConfig, type TLSOptions } from "bun";

export interface BunDevServerConfig extends Partial<BunDevServerSocketConfig> {
    port: number;
    buildConfig: BuildConfig;
    destingationPath: string;
    cleanDestination: boolean;
    enableTypeScriptWatch: boolean;
    serveOutputEjs?: string;
    serveOutputHtml?: string;
}

export interface BunDevServerSocketConfig {
    port: number;
    tls?: TLSOptions;
    websocketPath: string;
}