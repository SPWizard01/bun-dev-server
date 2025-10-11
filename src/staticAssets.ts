/**
 * Static assets management
 */
import { resolve } from "path";
import listingStylePath from "./static/serveOutputStyles.css";
import fileSvgPath from "./static/file.svg";
import folderSvgPath from "./static/folder.svg";
import parentSvgPath from "./static/parent.svg";

/**
 * Static assets loaded as Bun.file instances
 */
export const staticAssets = {
  listingStyle: Bun.file(resolve(import.meta.dir, listingStylePath)),
  fileSvg: Bun.file(resolve(import.meta.dir, fileSvgPath)),
  folderSvg: Bun.file(resolve(import.meta.dir, folderSvgPath)),
  parentSvg: Bun.file(resolve(import.meta.dir, parentSvgPath)),
};

/**
 * Routes for static assets
 */
export const staticAssetRoutes = {
  "/__bun_dev_server__/serveOutputStyles.css": staticAssets.listingStyle,
  "/__bun_dev_server__/file.svg": staticAssets.fileSvg,
  "/__bun_dev_server__/folder.svg": staticAssets.folderSvg,
  "/__bun_dev_server__/parent.svg": staticAssets.parentSvg,
};
