/**
 * Configuration management and validation
 */
import { type BuildConfig } from "bun";
import { resolve } from "path";
import serveTemplatePath from "./templates/output.ejs" //with { type: "text" };
import indexTemplatePath from "./templates/index.ejs" //with { type: "text" };
import { bunHotReloadPlugin, getBunHMRFooter } from "./bunHmrPlugin";
import { type BunDevServerConfig, type BuildEnv } from "./bunServeConfig";
import { DEFAULT_HMR_PATH } from "./bunClientHmr";
import { cleanDirectory, ensureDestinationDirectory } from "./utils/filesystem";

export interface PreparedConfig {
    finalConfig: BunDevServerConfig;
    serveDestination: string;
    buildDestination: string;
    watchDestination: string;
    buildCfg: BuildConfig;
}

const serveTemplate = await Bun.file(Bun.fileURLToPath(import.meta.resolve(serveTemplatePath))).text();
const indexTemplate = await Bun.file(Bun.fileURLToPath(import.meta.resolve(indexTemplatePath))).text();

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
    const defaultBuildDir = finalConfig.buildConfig.outdir ?? "./dist";
    const servePart = finalConfig.servePath ?? defaultBuildDir;
    const serveDestination = resolve(importMeta.dir, servePart);
    const watchDestination = resolve(importMeta.dir, finalConfig.watchDir);
    const buildDestination = resolve(importMeta.dir, defaultBuildDir);

    // Resolve entry points
    const allEntries = serverConfig.buildConfig.entrypoints.splice(0, serverConfig.buildConfig.entrypoints.length);
    const resolvedEntries = allEntries.map(e => resolve(importMeta.dir, e));
    serverConfig.buildConfig.entrypoints = resolvedEntries;


    // Ensure destination directory exists
    await ensureDestinationDirectory(buildDestination);
    await ensureDestinationDirectory(serveDestination);

    // Prepare build configuration
    const buncfg = {
        port: finalConfig.port,
        tls: finalConfig.tls,
        websocketPath: finalConfig.websocketPath,
        secure: finalConfig.tls !== undefined
    };

    const buildCfg: BuildConfig = {
        ...serverConfig.buildConfig,
        outdir: buildDestination,
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
        const buildDirOverOfServe = serveDestination.indexOf(buildDestination) !== -1;
        const serveDirOverOfBuild = buildDestination.indexOf(serveDestination) !== -1;
        if (serverConfig.cleanBuildPath && buildDirOverOfServe) {
            await cleanDirectory(env.buildDestination);
        };
        if (serverConfig.cleanServePath && serveDirOverOfBuild) {
            await cleanDirectory(env.serveDestination);
        };
        await userBeforeBuild?.(env);
    }

    return {
        finalConfig,
        serveDestination,
        buildDestination,
        watchDestination,
        buildCfg
    };
}


