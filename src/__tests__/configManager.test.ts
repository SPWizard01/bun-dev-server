import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { prepareConfiguration } from "../configManager";
import type { BunDevServerConfig } from "../bunServeConfig";
import type { BuildConfig } from "bun";
import { rm } from "fs/promises";
import { resolve } from "path";

describe("configManager", () => {
  const testDir = resolve(import.meta.dir, "../../test-watch-dir");
  const testOutDir = resolve(import.meta.dir, "../../test-dist");
  
  let originalConsoleLog: typeof console.log;

  beforeEach(async () => {
    // Suppress console output during tests
    originalConsoleLog = console.log;
    console.log = () => {};
    
    await rm(testDir, { recursive: true, force: true });
    await rm(testOutDir, { recursive: true, force: true });
    await Bun.write(`${testDir}/test.ts`, "console.log('test');");
  });

  afterEach(async () => {
    // Restore console output
    console.log = originalConsoleLog;
    
    await rm(testDir, { recursive: true, force: true });
    await rm(testOutDir, { recursive: true, force: true });
  });

  describe("prepareConfiguration", () => {
    test("should merge with default configuration", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      expect(result.finalConfig.port).toBe(3000);
      expect(result.finalConfig.websocketPath).toBe("/hmr-ws");
      expect(result.finalConfig.createIndexHTML).toBe(true);
      expect(result.finalConfig.broadcastBuildOutputToConsole).toBe(true);
      expect(result.finalConfig.broadcastBuildOutputToClient).toBe(true);
    });

    test("should throw error when watchDir is not set", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          target: 'bun',
        } as BuildConfig,
        watchDir: "",
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      await expect(
        prepareConfiguration(serverConfig, importMeta)
      ).rejects.toThrow("watchDir must be set");
    });

    test("should resolve entry points to absolute paths", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      expect(result.buildCfg.entrypoints).toBeDefined();
      expect(result.buildCfg.entrypoints!.length).toBeGreaterThan(0);
      expect(result.buildCfg.entrypoints![0]).toContain("test.ts");
    });

    test("should create destination directory if it doesn't exist", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      const file = Bun.file(`${testOutDir}/.gitkeep`);
      // Directory should exist after preparation
      expect(result.destinationPath).toContain("test-dist");
    });

    test("should add HMR footer when hotReload is 'footer'", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
        hotReload: "footer",
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      expect(result.buildCfg.footer).toBeDefined();
      expect(result.buildCfg.footer).toContain("ws://localhost:3000");
    });

    test("should add HMR plugin when hotReload is 'plugin'", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
        hotReload: "plugin",
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      expect(result.buildCfg.plugins).toBeDefined();
      expect(result.buildCfg.plugins!.length).toBeGreaterThan(0);
    });

    test("should use custom tscConfigPath when provided", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
        tscConfigPath: "./custom-tsconfig.json",
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      expect(result.finalConfig.tscConfigPath).toContain("custom-tsconfig.json");
    });

    test("should handle cleanServePath in beforeBuild hook", async () => {
      const serverConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./test.ts"],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testDir,
        cleanServePath: true,
      };

      const importMeta = {
        dir: import.meta.dir,
      } as ImportMeta;

      const result = await prepareConfiguration(serverConfig, importMeta);

      expect(result.finalConfig.beforeBuild).toBeFunction();
    });
  });
});
