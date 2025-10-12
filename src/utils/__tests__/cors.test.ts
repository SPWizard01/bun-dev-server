import { describe, test, expect } from "bun:test";
import { withCORSHeaders } from "../cors";

describe("cors utils", () => {
  describe("withCORSHeaders", () => {
    test("should add CORS headers to response", () => {
      const response = new Response("test");
      const result = withCORSHeaders(response);

      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(result.headers.get("Access-Control-Allow-Methods")).toBeDefined();
      expect(result.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(result.headers.get("Cache-Control")).toBeDefined();
    });

    test("should use origin from request when provided", () => {
      const response = new Response("test");
      const request = new Request("http://localhost:3000", {
        headers: {
          origin: "http://example.com",
        },
      });

      const result = withCORSHeaders(response, request);

      expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.com"
      );
    });

    test("should use wildcard when request has no origin", () => {
      const response = new Response("test");
      const request = new Request("http://localhost:3000");

      const result = withCORSHeaders(response, request);

      expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    test("should include all standard HTTP methods", () => {
      const response = new Response("test");
      const result = withCORSHeaders(response);

      const methods = result.headers.get("Access-Control-Allow-Methods");
      expect(methods).toContain("GET");
      expect(methods).toContain("POST");
      expect(methods).toContain("PUT");
      expect(methods).toContain("DELETE");
      expect(methods).toContain("PATCH");
      expect(methods).toContain("OPTIONS");
    });

    test("should set cache control to no-cache", () => {
      const response = new Response("test");
      const result = withCORSHeaders(response);

      const cacheControl = result.headers.get("Cache-Control");
      expect(cacheControl).toContain("no-store");
      expect(cacheControl).toContain("no-cache");
      expect(cacheControl).toContain("must-revalidate");
    });

    test("should preserve original response body", async () => {
      const originalBody = "test content";
      const response = new Response(originalBody);
      const result = withCORSHeaders(response);

      const body = await result.text();
      expect(body).toBe(originalBody);
    });

    test("should preserve original status code", () => {
      const response = new Response("test", { status: 404 });
      const result = withCORSHeaders(response);

      expect(result.status).toBe(404);
    });

    test("should work with different response types", () => {
      const jsonResponse = new Response(JSON.stringify({ key: "value" }), {
        headers: { "Content-Type": "application/json" },
      });

      const result = withCORSHeaders(jsonResponse);

      expect(result.headers.get("Content-Type")).toBe("application/json");
      expect(result.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    });
  });
});
