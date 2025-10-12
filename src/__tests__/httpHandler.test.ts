import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  handleErrorResponse,
  handlePathRequest,
} from "../httpHandler";
import type { BunDevServerConfig } from "../bunServeConfig";
import type { BuildConfig } from "bun";
import { rm } from "fs/promises";
import { resolve } from "path";

describe("httpHandler", () => {
  const testDistDir = resolve(import.meta.dir, "../../test-http-dist");
  
  let originalConsoleError: typeof console.error;

  beforeEach(async () => {
    // Suppress console.error for error handling tests
    originalConsoleError = console.error;
    console.error = () => {};
    
    await rm(testDistDir, { recursive: true, force: true });
    await Bun.write(`${testDistDir}/test.js`, "console.log('test');");
    await Bun.write(`${testDistDir}/test.css`, "body { margin: 0; }");
    await Bun.write(`${testDistDir}/subdir/nested.js`, "console.log('nested');");
  });

  afterEach(async () => {
    // Restore console.error
    console.error = originalConsoleError;
    
    await rm(testDistDir, { recursive: true, force: true });
  });

  describe("handleErrorResponse", () => {
    test("should return 500 response with error message", () => {
      const req = new Request("http://localhost:3000/test");
      const error = new Error("Test error");

      const response = handleErrorResponse(req, error);

      expect(response.status).toBe(500);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });

    test("should include request URL in error message", async () => {
      const testUrl = "http://localhost:3000/some-path";
      const req = new Request(testUrl);
      const error = new Error("Test error");

      const response = handleErrorResponse(req, error);
      const text = await response.text();

      expect(text).toContain(testUrl);
    });
  });

  describe("handlePathRequest", () => {
    let mockConfig: BunDevServerConfig;

    beforeEach(() => {
      mockConfig = {
        port: 3000,
        buildConfig: {} as BuildConfig,
        watchDir: "./src",
        logRequests: false,
        serveOutputEjs: "<html></html>",
      };
    });

    test("should return file content for existing file", async () => {
      const req = new Request("http://localhost:3000/test.js");
      const response = await handlePathRequest(
        "/test.js",
        req,
        mockConfig,
        testDistDir
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("console.log('test')");
    });

    test("should return 404 for non-existent file", async () => {
      const req = new Request("http://localhost:3000/nonexistent.js");
      const response = await handlePathRequest(
        "/nonexistent.js",
        req,
        mockConfig,
        testDistDir
      );

      expect(response.status).toBe(404);
    });

    test("should return directory listing for directory request", async () => {
      const req = new Request("http://localhost:3000/");
      const response = await handlePathRequest(
        "/",
        req,
        mockConfig,
        testDistDir
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
    });

    test("should handle nested directory files", async () => {
      const req = new Request("http://localhost:3000/subdir/nested.js");
      const response = await handlePathRequest(
        "/subdir/nested.js",
        req,
        mockConfig,
        testDistDir
      );

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("console.log('nested')");
    });

    test("should serve index.html when requesting root", async () => {
      await Bun.write(`${testDistDir}/index.html`, "<html><body>Index</body></html>");
      
      const req = new Request("http://localhost:3000/index.html");
      const response = await handlePathRequest(
        "/index.html",
        req,
        mockConfig,
        testDistDir
      );

      expect(response.status).toBe(200);
    });

    test("should have CORS headers", async () => {
      const req = new Request("http://localhost:3000/test.js");
      const response = await handlePathRequest(
        "/test.js",
        req,
        mockConfig,
        testDistDir
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });
  });
});
