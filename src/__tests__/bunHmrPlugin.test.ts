import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { bunHotReloadPlugin, getBunHMRFooter } from "../bunHmrPlugin";
import type { BunHMROptions } from "../bunHmrPlugin";
import { writeFile, rm, mkdir } from "fs/promises";
import { resolve } from "path";

describe("bunHmrPlugin", () => {
  const testDir = resolve(import.meta.dir, "../../test-hmr-plugin");

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    // Create test files with sample content
    await writeFile(`${testDir}/index.ts`, "console.log('test');");
    await writeFile(`${testDir}/app.tsx`, "export const App = () => <div>Test</div>;");
    await writeFile(`${testDir}/component.jsx`, "export const Component = () => <span>Test</span>;");
    await writeFile(`${testDir}/utils.js`, "export const util = () => {};");
    await writeFile(`${testDir}/helper.ts`, "export const helper = () => {};");
    await writeFile(`${testDir}/index.mts`, "console.log('module');");
    await writeFile(`${testDir}/utils.mjs`, "export const mjsUtil = () => {};");
    await writeFile(`${testDir}/app.mtsx`, "export const MApp = () => <div>Module</div>;");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("bunHotReloadPlugin", () => {
    test("should create a valid Bun plugin", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const plugin = bunHotReloadPlugin(config);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("hmr");
      expect(plugin.target).toBe("browser");
      expect(plugin.setup).toBeFunction();
    });

    test("should create plugin with secure connection", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: true,
      };

      const plugin = bunHotReloadPlugin(config);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("hmr");
    });

    test("should create plugin with custom websocket path", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
        websocketPath: "/custom-path",
      };

      const plugin = bunHotReloadPlugin(config);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("hmr");
    });

    test("should call setup function and register callbacks", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const plugin = bunHotReloadPlugin(config);

      const mockOnLoad = mock(() => {});
      const mockOnResolve = mock(() => {});
      const mockBuild = {
        config: {
          entrypoints: ["./src/index.ts", "./src/app.tsx"],
        },
        onLoad: mockOnLoad,
        onResolve: mockOnResolve,
      };

      plugin.setup(mockBuild as any);

      // Should register onLoad for JS/TS files
      expect(mockOnLoad).toHaveBeenCalledTimes(2);
      // Should register onResolve for bun-hot-reload
      expect(mockOnResolve).toHaveBeenCalledTimes(1);

      // Check the filter patterns
      const onLoadCalls = mockOnLoad.mock.calls as any[];
      expect(onLoadCalls[0]).toBeDefined();
      expect(onLoadCalls[0][0].filter).toBeDefined();
      expect(onLoadCalls[1]).toBeDefined();
      expect(onLoadCalls[1][0].filter).toBeDefined();

      const onResolveCalls = mockOnResolve.mock.calls as any[];
      expect(onResolveCalls[0]).toBeDefined();
      expect(onResolveCalls[0][0].filter).toBeDefined();
    });

    test("should resolve bun-hot-reload import", async () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const plugin = bunHotReloadPlugin(config);

      let onResolveCallback: any;
      const mockBuild = {
        config: {
          entrypoints: ["src/index.ts"],
        },
        onLoad: mock(() => {}),
        onResolve: mock((options: any, callback: any) => {
          onResolveCallback = callback;
        }),
      };

      plugin.setup(mockBuild as any);

      const result = await onResolveCallback({
        path: "bun-hot-reload",
      });

      expect(result).toBeDefined();
      expect(result.path).toBe("bun-hot-reload");
      expect(result.namespace).toBe("bun-hot-reload");
    });

    test("should load bun-hot-reload module with HMR code", async () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const plugin = bunHotReloadPlugin(config);

      let hmrLoadCallback: any;
      const mockBuild = {
        config: {
          entrypoints: ["src/index.ts"],
        },
        onLoad: mock((options: any, callback: any) => {
          if (options.namespace === "bun-hot-reload") {
            hmrLoadCallback = callback;
          }
        }),
        onResolve: mock(() => {}),
      };

      plugin.setup(mockBuild as any);

      const result = await hmrLoadCallback({
        path: "bun-hot-reload",
      });

      expect(result).toBeDefined();
      expect(result.contents).toContain("ws://localhost:3000/hmr-ws");
      expect(result.contents).toContain("hotReload");
      expect(result.loader).toBe("ts");
    });
  });

  describe("getBunHMRFooter", () => {
    test("should generate footer code with default configuration", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const footer = getBunHMRFooter(config);

      expect(footer).toBeDefined();
      expect(footer).toContain("ws://localhost:3000/hmr-ws");
      expect(footer).toStartWith(";(");
      expect(footer).toEndWith(")();");
    });

    test("should generate footer code with secure websocket", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: true,
      };

      const footer = getBunHMRFooter(config);

      expect(footer).toContain("wss://localhost:3000/hmr-ws");
    });

    test("should generate footer code with custom port", () => {
      const config: BunHMROptions = {
        port: 8080,
        secure: false,
      };

      const footer = getBunHMRFooter(config);

      expect(footer).toContain("ws://localhost:8080/hmr-ws");
    });

    test("should generate footer code with custom websocket path", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
        websocketPath: "/my-ws",
      };

      const footer = getBunHMRFooter(config);

      expect(footer).toContain("ws://localhost:3000/my-ws");
    });
  });
});
