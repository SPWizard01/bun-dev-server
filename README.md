# Bun Dev Server

```
//devserver.ts
import {startBunDevServer} from "bun-dev-server"

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
```

```
bun run devserver.ts
```