/**
 * File system utilities
 */
import { $ } from "bun";
import { access, constants } from "fs/promises";

/**
 * Clean a directory by removing all its contents
 * @param dst - The absolute path to the directory to clean
 */
export async function cleanDirectory(dst: string): Promise<void> {
  const { stderr, exitCode } = await $`rm -rf ${dst}/*`.nothrow();
  if (exitCode !== 0) {
    if (stderr.indexOf("no matches found") > -1) {
      console.log("Directory is empty");
    } else {
      console.warn("Unable to clean directory", stderr.toString("utf8"));
    }
  }
}

/**
 * Convert bytes to human-readable format
 * @param bytes - Number of bytes to convert
 * @returns A formatted string (e.g., "1.5 MB")
 */
export function convertBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  if (bytes == 0) {
    return "n/a";
  }
  const floored = Math.floor(Math.log(bytes) / Math.log(1024));
  const i = floored;

  if (i == 0) {
    return bytes + " " + sizes[i];
  }

  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
}

/**
 * Check if a file or directory exists and is readable
 * @param fsPath - The absolute path to check
 * @returns true if the object exists and is readable, false otherwise
 */
export async function checkObjectExists(fsPath: string): Promise<boolean> {
  try {
    await access(fsPath, constants.R_OK);
    return true;
  } catch (e) {
    if ((e as ErrnoException)?.code === "ENOENT") {
      return false;
    }
    const msg = `Error while accessing path ${fsPath}`;
    console.error(msg, e);
    return false;
  }
}
