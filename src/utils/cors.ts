/**
 * CORS (Cross-Origin Resource Sharing) utilities
 */

/**
 * Add CORS headers to a Response object
 * @param response - The Response object to add headers to
 * @param request - Optional Request object to get origin from
 * @returns The Response with CORS headers added
 */
export function withCORSHeaders(response: Response, request?: Request): Response {
  response.headers.set("Access-Control-Allow-Origin", request?.headers.get("origin") ?? "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}
