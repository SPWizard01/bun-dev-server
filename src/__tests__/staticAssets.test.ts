import { describe, test, expect } from "bun:test";
import { staticAssets, staticAssetRoutes } from "../staticAssets";

describe("staticAssets", () => {
  describe("staticAssets", () => {
    test("should have listingStyle asset", () => {
      expect(staticAssets.listingStyle).toBeDefined();
      expect(staticAssets.listingStyle).toBeInstanceOf(Bun.file("").constructor);
    });

    test("should have fileSvg asset", () => {
      expect(staticAssets.fileSvg).toBeDefined();
      expect(staticAssets.fileSvg).toBeInstanceOf(Bun.file("").constructor);
    });

    test("should have folderSvg asset", () => {
      expect(staticAssets.folderSvg).toBeDefined();
      expect(staticAssets.folderSvg).toBeInstanceOf(Bun.file("").constructor);
    });

    test("should have parentSvg asset", () => {
      expect(staticAssets.parentSvg).toBeDefined();
      expect(staticAssets.parentSvg).toBeInstanceOf(Bun.file("").constructor);
    });
  });

  describe("staticAssetRoutes", () => {
    test("should be an object with routes", () => {
      expect(staticAssetRoutes).toBeDefined();
      expect(typeof staticAssetRoutes).toBe("object");
    });

    test("should have at least 4 routes", () => {
      const routes = Object.keys(staticAssetRoutes);
      expect(routes.length).toBeGreaterThanOrEqual(4);
    });

    test("all routes should start with /__bun_dev_server__", () => {
      const routes = Object.keys(staticAssetRoutes);
      routes.forEach((route) => {
        expect(route).toStartWith("/__bun_dev_server__");
      });
    });

    test("should contain CSS file route", () => {
      const routes = Object.keys(staticAssetRoutes);
      const hasCssRoute = routes.some((route) => route.endsWith(".css"));
      expect(hasCssRoute).toBe(true);
    });

    test("should contain SVG file routes", () => {
      const routes = Object.keys(staticAssetRoutes);
      const svgRoutes = routes.filter((route) => route.endsWith(".svg"));
      expect(svgRoutes.length).toBeGreaterThanOrEqual(3);
    });

    test("all route values should be Bun.file instances", () => {
      const values = Object.values(staticAssetRoutes);
      values.forEach((value) => {
        expect(value).toBeInstanceOf(Bun.file("").constructor);
      });
    });
  });
});
