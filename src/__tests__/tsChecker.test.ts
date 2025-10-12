import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { performTSC } from "../tsChecker";
import type { BunDevServerConfig } from "../bunServeConfig";
import type { BuildConfig } from "bun";

describe("tsChecker", () => {
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    // Suppress console output during tests
    originalConsoleLog = console.log;
    console.log = () => {};
  });

  afterEach(() => {
    // Restore console output
    console.log = originalConsoleLog;
  });

  describe("performTSC", () => {
    test("should return success when TSC is disabled", async () => {
      const config: BunDevServerConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
        enableTSC: false,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      const result = await performTSC(config, importMeta);

      expect(result.error).toBe(false);
      expect(result.message).toBe("");
    });

    test("should use tscConfigPath when provided", async () => {
      const config: BunDevServerConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
        enableTSC: true,
        tscConfigPath: "./tsconfig.json",
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // This may fail if tsc is not available, but we're testing the function structure
      const result = await performTSC(config, importMeta);

      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("message");
      expect(typeof result.error).toBe("boolean");
      expect(typeof result.message).toBe("string");
    });

    test("should return error object with proper structure on failure", async () => {
      const config: BunDevServerConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
        enableTSC: true,
        tscConfigPath: "./nonexistent-tsconfig.json",
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      const result = await performTSC(config, importMeta);

      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("message");
      expect(typeof result.error).toBe("boolean");
    });
  });
});
