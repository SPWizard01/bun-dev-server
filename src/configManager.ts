/**
 * Configuration management and validation
 */
import { $, type BuildConfig } from "bun";
import { readdir } from "fs/promises";
import { resolve } from "path";
import serveTemplate from "./serveOutputTemplate.ejs" with { type: "text" };
import indexTemplate from "./indexHTMLTemplate.ejs" with { type: "text" };
import { bunHotReloadPlugin, getBunHMRFooter } from "./bunHmrPlugin";
import { type BunDevServerConfig, type BuildEnv } from "./bunServeConfig";
import { DEFAULT_HMR_PATH } from "./bunClientHmr";
import { cleanDirectory } from "./utils/filesystem";

export interface PreparedConfig {
    finalConfig: BunDevServerConfig;
    destinationPath: string;
    srcWatch: string;
    buildCfg: BuildConfig;
}

/**
 * Prepare and validate the server configuration
 * @param serverConfig - The user-provided server configuration
 * @param importMeta - The ImportMeta object from the caller
 * @returns The prepared configuration with resolved paths and build config
 */
export async function prepareConfiguration(
    serverConfig: BunDevServerConfig,
    importMeta: ImportMeta
): Promise<PreparedConfig> {
    // Merge with default configuration
    const defaultConfig: Partial<BunDevServerConfig> = {
        port: 3000,
        websocketPath: DEFAULT_HMR_PATH,
        serveOutputEjs: serveTemplate,
        serveIndexHtmlEjs: indexTemplate,
        createIndexHTML: true,
        tscConfigPath: resolve(importMeta.dir, "./tsconfig.json"),
        broadcastBuildOutputToConsole: true,
        broadcastBuildOutputToClient: true
    };

    const finalConfig: BunDevServerConfig = { ...defaultConfig, ...serverConfig };

    if (serverConfig.tscConfigPath) {
        finalConfig.tscConfigPath = resolve(importMeta.dir, serverConfig.tscConfigPath);
    }

    if (!finalConfig.watchDir) {
        throw new Error("watchDir must be set");
    }

    // Resolve paths
    const servePart = finalConfig.buildConfig.outdir ?? finalConfig.servePath ?? "./dist";
    const serveDestination = resolve(importMeta.dir, servePart);
    const watchDestination = resolve(importMeta.dir, finalConfig.watchDir);

    // Resolve entry points
    const allEntries = serverConfig.buildConfig.entrypoints.splice(0, serverConfig.buildConfig.entrypoints.length);
    const resolvedEntries = allEntries.map(e => resolve(importMeta.dir, e));
    serverConfig.buildConfig.entrypoints = resolvedEntries;

    const destinationPath = serveDestination;
    const srcWatch = watchDestination;

    // Ensure destination directory exists
    await ensureDestinationDirectory(destinationPath);

    // Prepare build configuration
    const buncfg = {
        port: finalConfig.port,
        tls: finalConfig.tls,
        websocketPath: finalConfig.websocketPath,
        secure: finalConfig.tls !== undefined
    };

    const buildCfg: BuildConfig = {
        ...serverConfig.buildConfig,
        outdir: destinationPath
    };

    // Add hot reload configuration
    if (finalConfig.hotReload === "footer") {
        if (!buildCfg.footer) {
            buildCfg.footer = "";
        }
        buildCfg.footer += getBunHMRFooter(buncfg);
    }

    if (finalConfig.hotReload === "plugin") {
        if (!buildCfg.plugins) {
            buildCfg.plugins = [];
        }
        buildCfg.plugins.push(bunHotReloadPlugin(buncfg));
    }

    const userBeforeBuild = finalConfig.beforeBuild;
    finalConfig.beforeBuild = async (env: BuildEnv) => {
        if (serverConfig.cleanServePath) {
            await cleanDirectory(env.destinationPath);
        };
        await userBeforeBuild?.(env);
    }

    return {
        finalConfig,
        destinationPath,
        srcWatch,
        buildCfg
    };
}

/**
 * Ensure the destination directory exists, create if it doesn't
 * @param destinationPath - The absolute path to the destination directory
 */
async function ensureDestinationDirectory(destinationPath: string): Promise<void> {
    try {
        await readdir(destinationPath);
    } catch (e) {
        if ((e as ErrnoException).code === "ENOENT") {
            console.log("Directory not found, creating it...");
            try {
                await $`mkdir ${destinationPath}`;
            } catch (e) {
                console.error("Unable to create directory", e);
            }
        } else {
            throw e;
        }
    }
}
