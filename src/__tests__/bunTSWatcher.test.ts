import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { startTSWatcher } from "../bunTSWatcher";
import type { Server } from "bun";

describe("bunTSWatcher", () => {
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

  describe("startTSWatcher", () => {
    test("should be a function", () => {
      expect(startTSWatcher).toBeFunction();
    });

    test("should accept server and watchDir parameters", () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const watchDir = new URL(`file://${process.cwd()}/src/`);

      // Verify function signature accepts the right parameters
      expect(() => {
        const promise = startTSWatcher(mockServer, watchDir);
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });

    test("should handle URL watchDir parameter", () => {
      const mockServer: Server<any> = {
        publish: mock(() => {}),
      } as any;

      const watchDir = new URL(`file://${process.cwd()}/`);

      expect(() => {
        const promise = startTSWatcher(mockServer, watchDir);
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });
  });
});
