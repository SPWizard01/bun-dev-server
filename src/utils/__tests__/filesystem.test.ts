import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import {
  cleanDirectory,
  convertBytes,
  checkObjectExists,
} from "../filesystem";
import { rm, writeFile, mkdir } from "fs/promises";
import { resolve } from "path";

describe("filesystem utils", () => {
  const testDir = resolve(import.meta.dir, "../../../test-filesystem");
  
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(async () => {
    // Suppress console output during tests
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = () => {};
    console.error = () => {};
    
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore console output
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    await rm(testDir, { recursive: true, force: true });
  });

  describe("cleanDirectory", () => {
    test("should remove all files in directory", async () => {
      await writeFile(`${testDir}/file1.txt`, "content1");
      await writeFile(`${testDir}/file2.txt`, "content2");

      await cleanDirectory(testDir);

      const file1Exists = await checkObjectExists(`${testDir}/file1.txt`);
      const file2Exists = await checkObjectExists(`${testDir}/file2.txt`);

      expect(file1Exists).toBe(false);
      expect(file2Exists).toBe(false);
    });

    test("should handle empty directory gracefully", async () => {
      // cleanDirectory should complete without throwing, even if directory is empty
      await cleanDirectory(testDir);
      // If we reach here, no error was thrown
      expect(true).toBe(true);
    });

    test("should remove nested directories", async () => {
      await mkdir(`${testDir}/nested`, { recursive: true });
      await writeFile(`${testDir}/nested/file.txt`, "content");

      await cleanDirectory(testDir);

      const nestedExists = await checkObjectExists(`${testDir}/nested`);
      expect(nestedExists).toBe(false);
    });

    test("should warn when directory has issues but not crash", async () => {
      // Create a special scenario: try to clean a path with special characters
      // that might cause issues in the shell command
      const weirdDir = `${testDir}/test-dir-with-special-chars`;
      await mkdir(weirdDir, { recursive: true });
      await writeFile(`${weirdDir}/file.txt`, "content");
      
      // Clean the directory - should work normally
      await cleanDirectory(weirdDir);
      
      // Verify it worked
      const fileExists = await checkObjectExists(`${weirdDir}/file.txt`);
      expect(fileExists).toBe(false);
    });

    test("should handle directory that requires special handling", async () => {
      // Test with a directory path that has spaces and special characters
      const specialDir = `${testDir}/test dir with spaces`;
      await mkdir(specialDir, { recursive: true });
      await writeFile(`${specialDir}/file.txt`, "content");
      
      await cleanDirectory(specialDir);
      
      const fileExists = await checkObjectExists(`${specialDir}/file.txt`);
      expect(fileExists).toBe(false);
    });
  });

  describe("convertBytes", () => {
    test("should convert 0 bytes", () => {
      expect(convertBytes(0)).toBe("n/a");
    });

    test("should display bytes for small values", () => {
      expect(convertBytes(100)).toBe("100 Bytes");
    });

    test("should convert to KB", () => {
      const result = convertBytes(1024);
      expect(result).toContain("KB");
      expect(result).toBe("1.0 KB");
    });

    test("should convert to MB", () => {
      const result = convertBytes(1024 * 1024);
      expect(result).toContain("MB");
      expect(result).toBe("1.0 MB");
    });

    test("should convert to GB", () => {
      const result = convertBytes(1024 * 1024 * 1024);
      expect(result).toContain("GB");
      expect(result).toBe("1.0 GB");
    });

    test("should convert to TB", () => {
      const result = convertBytes(1024 * 1024 * 1024 * 1024);
      expect(result).toContain("TB");
      expect(result).toBe("1.0 TB");
    });

    test("should handle decimal values correctly", () => {
      const result = convertBytes(1536); // 1.5 KB
      expect(result).toBe("1.5 KB");
    });

    test("should round to 1 decimal place", () => {
      const result = convertBytes(1234); // ~1.205 KB
      expect(result).toBe("1.2 KB");
    });

    test("should handle large numbers", () => {
      const result = convertBytes(1024 * 1024 * 1024 * 2.5); // 2.5 GB
      expect(result).toBe("2.5 GB");
    });
  });

  describe("checkObjectExists", () => {
    test("should return true for existing file", async () => {
      await writeFile(`${testDir}/exists.txt`, "content");

      const exists = await checkObjectExists(`${testDir}/exists.txt`);
      expect(exists).toBe(true);
    });

    test("should return false for non-existent file", async () => {
      const exists = await checkObjectExists(`${testDir}/nonexistent.txt`);
      expect(exists).toBe(false);
    });

    test("should return true for existing directory", async () => {
      const exists = await checkObjectExists(testDir);
      expect(exists).toBe(true);
    });

    test("should return false for non-existent directory", async () => {
      const exists = await checkObjectExists(`${testDir}/nonexistent-dir`);
      expect(exists).toBe(false);
    });

    test("should handle nested paths", async () => {
      await mkdir(`${testDir}/nested/deep`, { recursive: true });
      await writeFile(`${testDir}/nested/deep/file.txt`, "content");

      const exists = await checkObjectExists(`${testDir}/nested/deep/file.txt`);
      expect(exists).toBe(true);
    });

    test("should check readability", async () => {
      await writeFile(`${testDir}/readable.txt`, "content");

      const exists = await checkObjectExists(`${testDir}/readable.txt`);
      expect(exists).toBe(true);
    });

    test("should handle access errors gracefully", async () => {
      // Test with an invalid path that would cause an access error
      // Using a null byte in the path should cause an error other than ENOENT
      const invalidPath = `${testDir}/invalid\0path`;
      
      const exists = await checkObjectExists(invalidPath);
      
      // Should return false and log error without throwing
      expect(exists).toBe(false);
    });

    test("should handle permission-related errors", async () => {
      // Create a file and then try to check a path that would have permission issues
      // On Windows, we can simulate this by using reserved device names
      const reservedPath = "\\\\.\\CON"; // Windows reserved device name
      
      const exists = await checkObjectExists(reservedPath);
      
      // Should handle gracefully and return false
      expect(exists).toBe(false);
    });
  });
});
