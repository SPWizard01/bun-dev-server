import { $, build } from "bun";

await $`rm -rf dist`;

await build({
    entrypoints: ["./src/index.ts"],
    sourcemap: "linked",
    outdir: "./dist",
    naming: { asset: "assets/[name].[ext]" },
    target: "bun",
    minify: false,
    splitting: false,
    loader: {
        ".css": "file",
        ".svg": "file"
    }
});

await $`tsc -p tsconfig.json`