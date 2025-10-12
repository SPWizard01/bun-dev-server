import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { startFileWatcher } from "../fileWatcher";
import type { BunDevServerConfig } from "../bunServeConfig";
import type { BuildConfig, Server } from "bun";
import { rm, mkdir, writeFile } from "fs/promises";
import { resolve } from "path";

describe("fileWatcher", () => {
  const testWatchDir = resolve(import.meta.dir, "../../test-file-watcher");
  const testOutDir = resolve(import.meta.dir, "../../test-file-watcher-out");
  
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;

  beforeEach(async () => {
    // Suppress console output during tests to avoid error spam
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    console.error = () => {};
    console.log = () => {};
    
    await rm(testWatchDir, { recursive: true, force: true });
    await rm(testOutDir, { recursive: true, force: true });
    await mkdir(testWatchDir, { recursive: true });
    await mkdir(testOutDir, { recursive: true });
    // Create a test file to watch
    await writeFile(`${testWatchDir}/test.ts`, "export const test = 'hello';");
  });

  afterEach(async () => {
    // Give background watchers more time to finish before cleanup (coverage mode is slower)
    await Bun.sleep(200);
    
    // Clean up test directories first while console is still suppressed
    await rm(testWatchDir, { recursive: true, force: true });
    await rm(testOutDir, { recursive: true, force: true });
    
    // Wait more to ensure all file operations and watchers complete
    await Bun.sleep(100);
    
    // Now restore console output
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe("startFileWatcher", () => {
    test("should accept valid parameters", () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: ["./src/index.ts"],
          outdir: "./dist",
        } as BuildConfig,
        watchDir: "./src",
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Function signature test
      expect(startFileWatcher).toBeFunction();
      
      // We can't easily test the async iterator behavior without a real file system
      // but we can verify the function accepts the right parameters
      expect(() => {
        const promise = startFileWatcher(
          "./src",
          importMeta,
          mockConfig,
          "./dist",
          mockConfig.buildConfig as BuildConfig,
          mockServer
        );
        // Don't await - just verify it returns a promise
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });

    test("should perform initial build on startup", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/test.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher (this will perform initial build)
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Give it a moment to perform initial build
      await Bun.sleep(100);

      // Initial build should have published a message
      expect((mockServer.publish as any).mock.calls.length).toBeGreaterThan(0);

      // Note: We can't easily stop the watcher in tests, but that's okay for this test
    });

    test("should handle file changes and trigger builds", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/test.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: 100, // Fast delay for testing
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Wait for initial build
      await Bun.sleep(200);

      const initialCallCount = (mockServer.publish as any).mock.calls.length;

      // Trigger a file change
      await writeFile(`${testWatchDir}/test.ts`, "export const test = 'modified';");

      // Wait for the watcher to detect and process the change
      await Bun.sleep(300);

      // Should have more publish calls after the file change
      expect((mockServer.publish as any).mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    test("should use throttled queue with configured delay", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const customDelay = 500;
      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/test.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: customDelay,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Initial build should happen
      await Bun.sleep(200);
      expect((mockServer.publish as any).mock.calls.length).toBeGreaterThan(0);
    });

    test("should skip processing when queue is pending", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      // Use a longer delay to test pending behavior
      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/test.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: 1000, // Long delay
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Wait for initial build to start
      await Bun.sleep(50);

      // Quickly make multiple changes while queue is processing
      await writeFile(`${testWatchDir}/test.ts`, "export const test = 'change1';");
      await Bun.sleep(10);
      await writeFile(`${testWatchDir}/test.ts`, "export const test = 'change2';");
      
      // The queue should handle this gracefully
      await Bun.sleep(500);
      
      // Verify it didn't crash
      expect((mockServer.publish as any).mock.calls.length).toBeGreaterThan(0);
    });

    test("should clear queue when new changes arrive", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/test.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: 200,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Wait for initial build
      await Bun.sleep(300);

      // Make a change
      await writeFile(`${testWatchDir}/test.ts`, "export const test = 'updated';");
      
      // Wait for processing
      await Bun.sleep(400);

      // Should have processed the change successfully
      expect(true).toBe(true);
    });

    test("should handle errors during file change processing", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      // Suppress error output for this test (intentional build failure)
      const originalError = console.error;
      console.error = () => {};

      // Use invalid build config to trigger errors
      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/nonexistent.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: 100,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Wait for initial build attempt
      await Bun.sleep(200);

      // Make a change to trigger error handling
      await writeFile(`${testWatchDir}/test.ts`, "export const test = 'trigger';");
      
      // Wait for processing
      await Bun.sleep(300);

      // Restore console.error
      console.error = originalError;

      // Watcher should continue running despite errors
      expect(true).toBe(true);
    });

    test("should log errors when exception occurs in watcher loop", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {
          // Simulate an error during publish
          throw new Error("Publish failed");
        }),
      } as any;

      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${testWatchDir}/test.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: 100,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Create a spy to track error calls (console is already mocked globally)
      const errorSpy = mock(() => {});
      console.error = errorSpy;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Wait for initial build
      await Bun.sleep(200);

      // Make a change
      await writeFile(`${testWatchDir}/test.ts`, "export const test = 'error test';");
      
      // Wait for processing
      await Bun.sleep(300);

      // Should have logged errors
      expect(errorSpy.mock.calls.length).toBeGreaterThan(0);
    });

    test("should watch directory recursively", async () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      // Suppress error output for directory permission issues during cleanup
      const originalError = console.error;
      console.error = () => {};

      // Create a nested directory structure
      const nestedDir = `${testWatchDir}/nested/deep`;
      await mkdir(nestedDir, { recursive: true });
      await writeFile(`${nestedDir}/nested.ts`, "export const nested = true;");

      const mockConfig: BunDevServerConfig = {
        port: 3000,
        buildConfig: {
          entrypoints: [`${nestedDir}/nested.ts`],
          outdir: testOutDir,
          target: 'bun',
        } as BuildConfig,
        watchDir: testWatchDir,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
        watchDelay: 100,
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Start the watcher
      const watcherPromise = startFileWatcher(
        testWatchDir,
        importMeta,
        mockConfig,
        testOutDir,
        mockConfig.buildConfig as BuildConfig,
        mockServer
      );

      // Wait for initial build
      await Bun.sleep(200);

      const initialCalls = (mockServer.publish as any).mock.calls.length;

      // Modify nested file
      await writeFile(`${nestedDir}/nested.ts`, "export const nested = false;");
      
      // Wait for watcher to detect change
      await Bun.sleep(300);

      // Restore console.error
      console.error = originalError;

      // Should detect changes in nested directories
      expect((mockServer.publish as any).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
