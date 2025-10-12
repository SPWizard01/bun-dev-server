import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { bunHotReload, DEFAULT_HMR_PATH, hotReload } from "../bunClientHmr";
import type { BunHMROptions } from "../bunHmrPlugin";

describe("bunClientHmr", () => {
  describe("DEFAULT_HMR_PATH", () => {
    test("should be defined with correct value", () => {
      expect(DEFAULT_HMR_PATH).toBe("/hmr-ws");
    });
  });

  describe("bunHotReload", () => {
    test("should generate websocket code with default path", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const result = bunHotReload(config);

      expect(result).toContain("ws://localhost:3000/hmr-ws");
      expect(result).toContain("WebSocket");
      expect(result).toContain("Bun Dev Server");
    });

    test("should generate secure websocket code", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: true,
      };

      const result = bunHotReload(config);

      expect(result).toContain("wss://localhost:3000/hmr-ws");
    });

    test("should use custom websocket path", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
        websocketPath: "/custom-ws",
      };

      const result = bunHotReload(config);

      expect(result).toContain("ws://localhost:3000/custom-ws");
    });

    test("should handle websocket path without leading slash", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
        websocketPath: "custom-ws",
      };

      const result = bunHotReload(config);

      expect(result).toContain("ws://localhost:3000/custom-ws");
    });

    test("should generate code with different ports", () => {
      const config: BunHMROptions = {
        port: 8080,
        secure: false,
      };

      const result = bunHotReload(config);

      expect(result).toContain("ws://localhost:8080/hmr-ws");
    });

    test("should include message handling logic", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const result = bunHotReload(config);

      expect(result).toContain("messageHandler");
      expect(result).toContain("errorHandler");
      expect(result).toContain("closeHandler");
      expect(result).toContain("openHandler");
    });

    test("should include reload functionality", () => {
      const config: BunHMROptions = {
        port: 3000,
        secure: false,
      };

      const result = bunHotReload(config);

      expect(result).toContain('type === "reload"');
      expect(result).toContain("window.location.reload");
    });
  });

  describe("hotReload function execution", () => {
    let mockWindow: any;
    let mockWebSocket: any;
    let originalConsole: any;
    let originalWindow: any;
    let originalWebSocket: any;

    beforeEach(() => {
      // Save originals
      originalWindow = globalThis.window;
      originalWebSocket = globalThis.WebSocket;

      // Mock console methods
      originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        table: console.table,
      };
      console.log = mock(() => {});
      console.error = mock(() => {});
      console.warn = mock(() => {});
      console.table = mock(() => {});

      // Mock WebSocket
      mockWebSocket = {
        addEventListener: mock(() => {}),
        removeEventListener: mock(() => {}),
      };

      // Mock window object
      mockWindow = {
        BUN_DEV_SERVER: undefined,
        document: {
          getElementById: mock(() => null),
          createElement: mock(() => ({
            id: "",
            innerText: "",
          })),
          body: {
            appendChild: mock(() => {}),
          },
        },
        location: {
          reload: mock(() => {}),
        },
        WebSocket: mock(() => mockWebSocket),
      };

      // Set global mocks
      (globalThis as any).window = mockWindow;
      (globalThis as any).WebSocket = mockWindow.WebSocket;
    });

    afterEach(() => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.table = originalConsole.table;
      
      // Restore originals
      (globalThis as any).window = originalWindow;
      (globalThis as any).WebSocket = originalWebSocket;
    });

    test("should initialize BUN_DEV_SERVER array if not exists", () => {
      hotReload();
      expect(Array.isArray(mockWindow.BUN_DEV_SERVER)).toBe(true);
    });

    test("should not reconnect if socket already exists", () => {
      // Pre-populate with existing socket
      mockWindow.BUN_DEV_SERVER = [
        { url: "[REPLACE_ENDPOINT]", socket: mockWebSocket },
      ];

      hotReload();

      // WebSocket constructor should not be called since socket exists
      expect(mockWindow.WebSocket).not.toHaveBeenCalled();
    });

    test("should create new WebSocket connection", () => {
      hotReload();
      expect(mockWindow.WebSocket).toHaveBeenCalledWith("[REPLACE_ENDPOINT]");
    });

    test("should add event listeners to WebSocket", () => {
      hotReload();

      expect(mockWebSocket.addEventListener).toHaveBeenCalledTimes(4);
      // Check that all required event listeners are added
      const calls = (mockWebSocket.addEventListener as any).mock.calls;
      const eventTypes = calls.map((call: any) => call[0]);
      expect(eventTypes).toContain("error");
      expect(eventTypes).toContain("message");
      expect(eventTypes).toContain("close");
      expect(eventTypes).toContain("open");
    });

    test("should handle message type 'reload'", () => {
      hotReload();

      // Get the message handler
      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      // Simulate reload message
      const messageEvent = {
        data: JSON.stringify({ type: "reload" }),
      };

      messageHandler(messageEvent);

      expect(mockWindow.location.reload).toHaveBeenCalled();
    });

    test("should handle message type 'message'", () => {
      hotReload();

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      const messageEvent = {
        data: JSON.stringify({ type: "message", message: "Test message" }),
      };

      messageHandler(messageEvent);

      expect(console.log).toHaveBeenCalled();
    });

    test("should handle message type 'output'", () => {
      hotReload();

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      const messageEvent = {
        data: JSON.stringify({ type: "output", message: "Build output" }),
      };

      messageHandler(messageEvent);

      expect(console.table).toHaveBeenCalled();
    });

    test("should handle message type 'tscerror'", () => {
      hotReload();

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      const messageEvent = {
        data: JSON.stringify({ type: "tscerror", message: "TypeScript error" }),
      };

      messageHandler(messageEvent);

      expect(console.error).toHaveBeenCalled();
    });

    test("should handle message type 'error' and create error div", () => {
      const mockDiv = {
        id: "",
        innerText: "",
      };
      mockWindow.document.getElementById = mock(() => null);
      mockWindow.document.createElement = mock(() => mockDiv);

      hotReload();

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      const messageEvent = {
        data: JSON.stringify({ type: "error", message: "Error message" }),
      };

      messageHandler(messageEvent);

      expect(console.error).toHaveBeenCalled();
      expect(mockWindow.document.createElement).toHaveBeenCalledWith("div");
      expect(mockWindow.document.body.appendChild).toHaveBeenCalled();
      expect(mockDiv.id).toBe("bun-hmr-error");
    });

    test("should handle message type 'error' with existing error div", () => {
      const existingDiv = {
        id: "bun-hmr-error",
        innerText: "Previous error",
      };
      mockWindow.document.getElementById = mock(() => existingDiv);

      hotReload();

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      const messageEvent = {
        data: JSON.stringify({ type: "error", message: "New error" }),
      };

      messageHandler(messageEvent);

      // Should not create a new div
      expect(mockWindow.document.createElement).not.toHaveBeenCalled();
      // Should not append (div already exists)
      expect(mockWindow.document.body.appendChild).not.toHaveBeenCalled();
    });

    test("should handle non-JSON message data", () => {
      hotReload();

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "message"
      )?.[1];

      // Non-JSON data should not throw
      const messageEvent = {
        data: "plain text message",
      };

      expect(() => messageHandler(messageEvent)).not.toThrow();
    });

    test("should handle error event", () => {
      hotReload();

      const errorHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "error"
      )?.[1];

      const errorEvent = new Event("error");
      errorHandler(errorEvent);

      expect(console.error).toHaveBeenCalled();
    });

    test("should handle close event and attempt reconnection", () => {
      // Mock setTimeout to capture the reconnection attempt
      const originalSetTimeout = globalThis.setTimeout;
      let reconnectCallback: Function | undefined;
      const mockSetTimeout = mock((fn: Function, delay: number) => {
        // Verify the delay is 5000ms
        expect(delay).toBe(5000);
        // Store the callback to execute it
        reconnectCallback = fn;
        return 123 as any;
      });
      (globalThis as any).setTimeout = mockSetTimeout;

      hotReload();

      const closeHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "close"
      )?.[1];

      const closeEvent = { code: 1000, reason: "Normal closure" } as CloseEvent;
      closeHandler(closeEvent);

      expect(console.warn).toHaveBeenCalled();
      expect(mockSetTimeout).toHaveBeenCalled();
      expect(mockWebSocket.removeEventListener).toHaveBeenCalledTimes(4);

      // Execute the reconnection callback to cover lines 69-70
      if (reconnectCallback) {
        // Reset the WebSocket mock for reconnection
        if (mockWindow.WebSocket.mockClear) {
          mockWindow.WebSocket.mockClear();
        }
        mockWindow.BUN_DEV_SERVER[0].socket = null;
        
        // Execute the reconnection
        reconnectCallback();
        
        // Verify reconnection attempt was logged
        expect(console.log).toHaveBeenCalled();
      }

      // Restore
      (globalThis as any).setTimeout = originalSetTimeout;
    });

    test("should handle open event", () => {
      hotReload();

      const openHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === "open"
      )?.[1];

      const openEvent = new Event("open");
      openHandler(openEvent);

      expect(console.log).toHaveBeenCalled();
    });

    test("should reuse existing server entry if found", () => {
      const existingSocket = { mock: "socket" };
      mockWindow.BUN_DEV_SERVER = [
        { url: "[REPLACE_ENDPOINT]", socket: existingSocket },
      ];

      hotReload();

      // Should not create new WebSocket since socket already exists
      expect(mockWindow.WebSocket).not.toHaveBeenCalled();
    });

    test("should create server entry if not found", () => {
      mockWindow.BUN_DEV_SERVER = [
        { url: "ws://localhost:9999/other", socket: null },
      ];

      hotReload();

      expect(mockWindow.WebSocket).toHaveBeenCalled();
      expect(mockWindow.BUN_DEV_SERVER.length).toBe(2);
    });
  });
});
