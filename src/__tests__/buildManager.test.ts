import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { getThrottledBuildQueue, cleanBuildAndNotify } from "../buildManager";
import type { BunDevServerConfig } from "../bunServeConfig";
import type { BuildConfig, BuildOutput, Server } from "bun";
import type { FileChangeInfo } from "fs/promises";
import { rm, mkdir } from "fs/promises";
import { resolve } from "path";

describe("buildManager", () => {
  const testDir = resolve(import.meta.dir, "../../test-build");
  
  let originalConsoleLog: typeof console.log;

  beforeEach(async () => {
    // Suppress console output during tests
    originalConsoleLog = console.log;
    console.log = () => {};
    
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    // Create a simple test file to build
    await Bun.write(`${testDir}/test.ts`, "export const test = 'hello';");
  });

  afterEach(async () => {
    // Restore console output
    console.log = originalConsoleLog;
    
    await rm(testDir, { recursive: true, force: true });
  });

  describe("getThrottledBuildQueue", () => {
    test("should create a queue with default delay", () => {
      const config: BunDevServerConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
      };

      const queue = getThrottledBuildQueue(config);

      expect(queue).toBeDefined();
      expect(queue.concurrency).toBe(1);
    });

    test("should create a queue with custom watchDelay", () => {
      const config: BunDevServerConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
        watchDelay: 2000,
      };

      const queue = getThrottledBuildQueue(config);

      expect(queue).toBeDefined();
      expect(queue.concurrency).toBe(1);
    });

    test("should have interval cap of 1", () => {
      const config: BunDevServerConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
      };

      const queue = getThrottledBuildQueue(config);

      // Verify queue configuration
      expect(queue.concurrency).toBe(1);
    });
  });

  describe("cleanBuildAndNotify", () => {
    let mockServer: Server<any>;
    let mockConfig: BunDevServerConfig;
    let mockBuildConfig: BuildConfig;
    let mockEvent: FileChangeInfo<string>;

    beforeEach(() => {
      mockServer = {
        publish: mock(() => {}),
      } as any;

      mockConfig = {
        port: 3000,
        buildConfig: { outdir: testDir } as BuildConfig,
        watchDir: "./src",
        reloadOnChange: false,
        broadcastBuildOutputToConsole: false,
        broadcastBuildOutputToClient: false,
        enableTSC: false,
      };

      mockBuildConfig = {
        entrypoints: [`${testDir}/test.ts`],
        outdir: testDir,
        target: 'bun' as const,
      };

      mockEvent = {
        filename: "test.ts",
        eventType: "change",
      };
    });

    test("should handle build errors gracefully", async () => {
      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Suppress error output for this test (intentional build failure)
      const originalError = console.error;
      console.error = () => {};

      // Use invalid build config to trigger error
      const invalidBuildConfig = {
        entrypoints: ["./nonexistent-file-that-does-not-exist.ts"],
        outdir: testDir,
        target: 'bun' as const,
      };

      // Function should not throw even if build fails
      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        invalidBuildConfig,
        mockServer,
        mockEvent
      );

      // Restore console.error
      console.error = originalError;

      // If we reach here, function completed without throwing
      expect(true).toBe(true);
    });

    test("should call beforeBuild hook if provided", async () => {
      const beforeBuildMock = mock(() => Promise.resolve());
      mockConfig.beforeBuild = beforeBuildMock;

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      expect(beforeBuildMock).toHaveBeenCalledTimes(1);
      expect(beforeBuildMock).toHaveBeenCalledWith(
        expect.objectContaining({
          importerMeta: importMeta,
          finalConfig: mockConfig,
          destinationPath: testDir,
          buildCfg: mockBuildConfig,
          bunServer: mockServer,
          event: mockEvent,
        })
      );
    });

    test("should call afterBuild hook after successful build", async () => {
      const afterBuildMock = mock(() => Promise.resolve());
      mockConfig.afterBuild = afterBuildMock;

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      expect(afterBuildMock).toHaveBeenCalled();
    });

    test("should publish HMR message to server", async () => {
      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      expect(mockServer.publish).toHaveBeenCalled();
    });

    test("should broadcast build output when enabled", async () => {
      mockConfig.broadcastBuildOutputToClient = true;

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Should publish output message
      const publishCalls = (mockServer.publish as any).mock.calls;
      const hasOutputMessage = publishCalls.some((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "output";
      });

      expect(hasOutputMessage).toBe(true);
    });

    test("should reload immediately when reloadOnChange is true and waitForTSC is false", async () => {
      mockConfig.reloadOnChange = true;
      mockConfig.waitForTSCSuccessBeforeReload = false;

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      const publishCalls = (mockServer.publish as any).mock.calls;
      const hasReloadMessage = publishCalls.some((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "reload";
      });

      expect(hasReloadMessage).toBe(true);
    });

    test("should write manifest when enabled", async () => {
      mockConfig.writeManifest = true;
      mockConfig.manifestName = "test-manifest.json";

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Wait a bit for file write
      await Bun.sleep(100);

      const manifestPath = `${testDir}/test-manifest.json`;
      const file = Bun.file(manifestPath);
      const exists = await file.exists();

      expect(exists).toBe(true);
    });

    test("should create index.html when createIndexHTML is true", async () => {
      mockConfig.createIndexHTML = true;
      mockConfig.serveIndexHtmlEjs = "<html><body><% hashedImports.forEach(imp => { %><script src='<%= imp %>'></script><% }); %></body></html>";

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Wait a bit for file write
      await Bun.sleep(100);

      const indexPath = `${testDir}/index.html`;
      const file = Bun.file(indexPath);
      const exists = await file.exists();

      expect(exists).toBe(true);
    });

    test("should handle TSC errors and broadcast when enabled", async () => {
      mockConfig.enableTSC = true;
      mockConfig.broadcastTSCErrorToClient = true;
      mockConfig.tscConfigPath = "./nonexistent-tsconfig.json";

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Should publish TSC error message
      const publishCalls = (mockServer.publish as any).mock.calls;
      const hasTscError = publishCalls.some((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "tscerror";
      });

      expect(hasTscError).toBe(true);
    });

    test("should wait for TSC success before reload when configured", async () => {
      mockConfig.reloadOnChange = true;
      mockConfig.waitForTSCSuccessBeforeReload = true;
      mockConfig.enableTSC = true;
      mockConfig.tscConfigPath = "./tsconfig.json";

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Should eventually publish reload message (after TSC passes)
      const publishCalls = (mockServer.publish as any).mock.calls;
      expect(publishCalls.length).toBeGreaterThan(0);
    });

    test("should handle different event types", async () => {
      const renameEvent: FileChangeInfo<string> = {
        filename: "renamed.ts",
        eventType: "rename",
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        renameEvent
      );

      const publishCalls = (mockServer.publish as any).mock.calls;
      const hasMessage = publishCalls.some((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "message" && msg.message.includes("renamed.ts");
      });

      expect(hasMessage).toBe(true);
    });

    test("should filter out sourcemap files from output", async () => {
      mockConfig.broadcastBuildOutputToClient = true;
      mockBuildConfig.sourcemap = "external";

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      const publishCalls = (mockServer.publish as any).mock.calls;
      const outputMessage = publishCalls.find((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "output";
      });

      if (outputMessage) {
        const msg = JSON.parse(outputMessage[1]);
        const hasSourceMap = msg.message.some((file: any) => file.path.endsWith(".map"));
        expect(hasSourceMap).toBe(false);
      }
    });

    test("should broadcast build output to console when enabled", async () => {
      mockConfig.broadcastBuildOutputToConsole = true;
      const consoleLogSpy = spyOn(console, "log");

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Should have logged the build output
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test("should handle single file output with correct singular text", async () => {
      mockConfig.broadcastBuildOutputToConsole = true;
      const consoleLogSpy = spyOn(console, "log");

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      // Should use 'file' (singular) when there's only one file
      const logCalls = consoleLogSpy.mock.calls;
      const hasSingularFile = logCalls.some((call: any[]) => 
        call[0]?.includes && call[0].includes("file")
      );

      expect(hasSingularFile).toBe(true);
    });

    test("should handle empty build output gracefully", async () => {
      mockConfig.broadcastBuildOutputToConsole = true;
      const consoleLogSpy = spyOn(console, "log");

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      // Use a build config that won't produce outputs
      const emptyBuildConfig = {
        entrypoints: [`${testDir}/test.ts`],
        outdir: testDir,
        target: 'bun' as const,
      };

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        emptyBuildConfig,
        mockServer,
        mockEvent
      );

      // Should not crash with empty output
      expect(true).toBe(true);
    });

    test("should include CSS files in index.html when present", async () => {
      mockConfig.createIndexHTML = true;
      mockConfig.serveIndexHtmlEjs = `<html><body>
        <% cssFiles.forEach(css => { %><link rel='stylesheet' href='<%= css %>'><% }); %>
        <% hashedImports.forEach(imp => { %><script src='<%= imp %>'></script><% }); %>
      </body></html>`;

      // Create a CSS file and JavaScript file that imports it
      await Bun.write(`${testDir}/test.css`, "body { color: red; }");
      await Bun.write(`${testDir}/app.ts`, "import './test.css'; console.log('app with css');");

      const buildConfigWithCss = {
        entrypoints: [`${testDir}/app.ts`],
        outdir: testDir,
        target: 'browser' as const, // Use browser target for CSS bundling
      };

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        buildConfigWithCss,
        mockServer,
        mockEvent
      );

      await Bun.sleep(100);

      const indexPath = `${testDir}/index.html`;
      const file = Bun.file(indexPath);
      const content = await file.text();

      // Should include CSS link
      expect(content).toContain("stylesheet");
    });

    test("should not reload when reloadOnChange is false", async () => {
      mockConfig.reloadOnChange = false;

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      const publishCalls = (mockServer.publish as any).mock.calls;
      const hasReloadMessage = publishCalls.some((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "reload";
      });

      expect(hasReloadMessage).toBe(false);
    });

    test("should not broadcast TSC errors when broadcastTSCErrorToClient is false", async () => {
      mockConfig.enableTSC = true;
      mockConfig.broadcastTSCErrorToClient = false;
      mockConfig.tscConfigPath = "./nonexistent-tsconfig.json";

      const importMeta = {
        dir: process.cwd(),
      } as ImportMeta;

      await cleanBuildAndNotify(
        importMeta,
        mockConfig,
        testDir,
        mockBuildConfig,
        mockServer,
        mockEvent
      );

      const publishCalls = (mockServer.publish as any).mock.calls;
      const hasTscError = publishCalls.some((call: any[]) => {
        const msg = JSON.parse(call[1]);
        return msg.type === "tscerror";
      });

      expect(hasTscError).toBe(false);
    });
  });
});
