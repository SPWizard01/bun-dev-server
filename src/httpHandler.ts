/**
 * HTTP request handling
 */
import { render } from "ejs";
import { readFile, readdir } from "fs/promises";
import { type BunDevServerConfig } from "./bunServeConfig";
import { withCORSHeaders } from "./utils/cors";
import { checkObjectExists } from "./utils/filesystem";

/**
 * Handle HTTP error responses
 * @param req - The Request object
 * @param err - The error that occurred
 * @returns A Response with status 500
 */
export function handleErrorResponse(req: Request, err: unknown): Response {
  const msg = `Error while processing request ${req.url}`;
  console.error(msg, err);
  return withCORSHeaders(new Response(msg, { status: 500 }), req);
}

/**
 * Handle a path request to the server
 * @param requestPath - The request path
 * @param req - The Request object
 * @param finalConfig - The final server configuration
 * @param destinationPath - The absolute path to the output directory
 * @returns A Response object
 */
export async function handlePathRequest(
  requestPath: string,
  req: Request,
  finalConfig: BunDevServerConfig,
  destinationPath: string
): Promise<Response> {
  let fsPath = destinationPath + requestPath;
  const objThere = await checkObjectExists(fsPath);
  let isDirectory = false;

  if (objThere) {
    try {
      await readFile(fsPath);
    } catch (e) {
      if ((e as ErrnoException).code === "EISDIR") {
        isDirectory = true;
      } else {
        throw e;
      }
    }
  } else {
    if (requestPath.toLowerCase() !== "/index.html") {
      finalConfig.logRequests && console.log(`${404} ${req.url}`);
      return withCORSHeaders(new Response("", { status: 404 }), req);
    }
    requestPath = "/";
    isDirectory = true;
    fsPath = destinationPath + requestPath;
  }

  if (!isDirectory) {
    return handleFileRequest(fsPath, req, finalConfig);
  }

  return handleDirectoryRequest(fsPath, requestPath, req, finalConfig);
}

/**
 * Handle a file request
 * @param fsPath - The file system path
 * @param req - The Request object
 * @param finalConfig - The final server configuration
 * @returns A Response object
 */
async function handleFileRequest(
  fsPath: string,
  req: Request,
  finalConfig: BunDevServerConfig
): Promise<Response> {
  try {
    const fl = Bun.file(fsPath);
    finalConfig.logRequests && console.log(`${200} ${req.url}`);
    return withCORSHeaders(new Response(fl), req);
  } catch (e) {
    if ((e as ErrnoException)?.code === "ENOENT") {
      finalConfig.logRequests && console.log(`${404} ${req.url}`);
      return withCORSHeaders(new Response("", { status: 404 }), req);
    } else {
      return handleErrorResponse(req, e);
    }
  }
}

/**
 * Handle a directory listing request
 * @param fsPath - The file system path
 * @param requestPath - The request path
 * @param req - The Request object
 * @param finalConfig - The final server configuration
 * @returns A Response object with directory listing HTML
 */
async function handleDirectoryRequest(
  fsPath: string,
  requestPath: string,
  req: Request,
  finalConfig: BunDevServerConfig
): Promise<Response> {
  try {
    const allEntries = await readdir(fsPath, {
      withFileTypes: true,
    });

    const dirs = allEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        return {
          requestPath: requestPath === "/" ? "" : requestPath,
          name: entry.name,
        };
      });

    const files = allEntries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        return {
          requestPath: requestPath === "/" ? "" : requestPath,
          name: entry.name,
        };
      });

    const templatePath = requestPath === "/" ? "" : requestPath;
    const rnd = render(finalConfig.serveOutputEjs!, {
      dirs,
      files,
      requestPath: templatePath,
    });

    finalConfig.logRequests && console.log(`${200} ${req.url}`);
    return withCORSHeaders(
      new Response(rnd, { headers: { "Content-Type": "text/html" } }),
      req
    );
  } catch (err) {
    return handleErrorResponse(req, err);
  }
}
