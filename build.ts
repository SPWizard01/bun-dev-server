import { $, build } from "bun";

await $`rm -rf dist`;

await build({ entrypoints: ["./src/index.ts"], outdir: "./dist", target: "bun", minify: false, splitting: false });

await $`tsc -p tsconfig.json`