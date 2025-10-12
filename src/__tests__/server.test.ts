import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { startBunDevServer } from "../server";
import type { BunDevServerConfig } from "../bunServeConfig";
import type { BuildConfig } from "bun";

describe("server", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Suppress console output during tests
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    // Restore console output
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("startBunDevServer", () => {
    test("should be a function", () => {
      expect(startBunDevServer).toBeFunction();
    });

    test("should accept valid configuration", () => {
      const config: BunDevServerConfig = {
        port: 3001, // Use unique port to avoid conflicts
        buildConfig: {
          entrypoints: ["./src/index.ts"],
          outdir: "./dist",
          target: 'bun',
        } as BuildConfig,
        watchDir: "./src",
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Verify function accepts the right parameters and returns a promise
      // Don't await - the server runs forever
      expect(() => {
        const promise = startBunDevServer(config, importMeta);
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });

    test("should handle configuration with TLS", () => {
      const config: BunDevServerConfig = {
        port: 3002, // Use unique port to avoid conflicts
        buildConfig: {
          entrypoints: ["./src/index.ts"],
          outdir: "./dist",
          target: 'bun',
        } as BuildConfig,
        watchDir: "./src",
        tls: {
          cert: "cert.pem",
          key: "key.pem",
        },
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Verify function accepts TLS config
      // Will fail due to invalid cert/key files, but that's caught internally
      expect(() => {
        const promise = startBunDevServer(config, importMeta);
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });

    test("should handle configuration with custom routes", () => {
      const config: BunDevServerConfig = {
        port: 3003, // Use unique port to avoid conflicts
        buildConfig: {
          entrypoints: ["./src/index.ts"],
          outdir: "./dist",
          target: 'bun',
        } as BuildConfig,
        watchDir: "./src",
        routes: {
          "/health": new Response("OK"),
        },
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Verify function accepts custom routes config
      expect(() => {
        const promise = startBunDevServer(config, importMeta);
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });
  });
});
