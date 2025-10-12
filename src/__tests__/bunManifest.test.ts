import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeManifest } from "../bunManifest";
import type { BuildOutput } from "bun";
import { readFile, rm, mkdir } from "fs/promises";
import { resolve } from "path";

describe("bunManifest", () => {
  const testOutDir = resolve(import.meta.dir, "../../test-output");

  beforeEach(async () => {
    await rm(testOutDir, { recursive: true, force: true });
    await mkdir(testOutDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testOutDir, { recursive: true, force: true });
  });

  describe("writeManifest", () => {
    test("should write manifest file with default name", async () => {
      const mockOutput: BuildOutput = {
        outputs: [
          {
            kind: "entry-point",
            path: `${testOutDir}/main.js`,
            hash: "abc123",
            size: 1024,
            type: "file",
            loader: "js",
          } as any,
        ],
        logs: [],
        success: true,
      };

      writeManifest(mockOutput, testOutDir);

      // Wait a bit for file write
      await Bun.sleep(100);

      const manifestPath = `${testOutDir}/bun_server_manifest.json`;
      const file = Bun.file(manifestPath);
      const exists = await file.exists();
      expect(exists).toBe(true);

      const content = await file.json();
      expect(content).toHaveProperty("js");
      expect(Array.isArray(content.js)).toBe(true);
    });

    test("should write manifest with custom name", async () => {
      const mockOutput: BuildOutput = {
        outputs: [
          {
            kind: "entry-point",
            path: `${testOutDir}/main.js`,
            hash: "abc123",
            size: 1024,
            type: "file",
            loader: "js",
          } as any,
        ],
        logs: [],
        success: true,
      };

      const customName = "custom-manifest.json";
      writeManifest(mockOutput, testOutDir, false, customName);

      await Bun.sleep(100);

      const manifestPath = `${testOutDir}/${customName}`;
      const file = Bun.file(manifestPath);
      const exists = await file.exists();
      expect(exists).toBe(true);
    });

    test("should include hash when withHash is true", async () => {
      const mockOutput: BuildOutput = {
        outputs: [
          {
            kind: "entry-point",
            path: `${testOutDir}/main.js`,
            hash: "abc123",
            size: 1024,
            type: "file",
            loader: "js",
          } as any,
        ],
        logs: [],
        success: true,
      };

      writeManifest(mockOutput, testOutDir, true);

      await Bun.sleep(100);

      const manifestPath = `${testOutDir}/bun_server_manifest.json`;
      const file = Bun.file(manifestPath);
      const content = await file.json();

      expect(content.js.length).toBeGreaterThan(0);
      expect(content.js[0]).toContain("?abc123");
    });

    test("should not include hash when withHash is false", async () => {
      const mockOutput: BuildOutput = {
        outputs: [
          {
            kind: "entry-point",
            path: `${testOutDir}/main.js`,
            hash: "abc123",
            size: 1024,
            type: "file",
            loader: "js",
          } as any,
        ],
        logs: [],
        success: true,
      };

      writeManifest(mockOutput, testOutDir, false);

      await Bun.sleep(100);

      const manifestPath = `${testOutDir}/bun_server_manifest.json`;
      const file = Bun.file(manifestPath);
      const content = await file.json();

      expect(content.js.length).toBeGreaterThan(0);
      expect(content.js[0]).not.toContain("?");
    });

    test("should only include entry-point outputs", async () => {
      const mockOutput: BuildOutput = {
        outputs: [
          {
            kind: "entry-point",
            path: `${testOutDir}/main.js`,
            hash: "abc123",
            size: 1024,
            type: "file",
            loader: "js",
          } as any,
          {
            kind: "chunk",
            path: `${testOutDir}/chunk.js`,
            hash: "def456",
            size: 512,
            type: "file",
            loader: "js",
          } as any,
        ],
        logs: [],
        success: true,
      };

      writeManifest(mockOutput, testOutDir);

      await Bun.sleep(100);

      const manifestPath = `${testOutDir}/bun_server_manifest.json`;
      const file = Bun.file(manifestPath);
      const content = await file.json();

      expect(content.js.length).toBe(1);
      expect(content.js[0]).toContain("main.js");
    });
  });
});
