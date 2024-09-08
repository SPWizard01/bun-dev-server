import { startBunDevServer } from "../index"

startBunDevServer({
    buildConfig: {
        entrypoints: ["./src/app.ts"],
        outdir: "dist",
        splitting: true,
        naming: {
            asset: "assets/[name]-[hash].[ext]",
            chunk: "chunks/[name]-[hash].[ext]",
        }
    },
    cleanServePath: true,
    port: 4567,
    enableTypeScriptWatch: true,
    watchDir: "./src",
})