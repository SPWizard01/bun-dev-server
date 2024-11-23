# Bun Dev Server

```ts
//devserver.ts
import { startBunDevServer } from "bun-dev-server";
import { file } from "bun";

startBunDevServer({
  buildConfig: {
    entrypoints: ["./src/app.ts"],
    //...
    outdir: "dist",
    splitting: true,
    naming: {
      asset: "assets/[name]-[hash].[ext]",
      chunk: "chunks/[name]-[hash].[ext]",
    },
  },
  tls: {
    cert: file("./serve_cert.pem"),
    key: file("./serve_key.pem"),
  },
  writeManifest: true,
  cleanServePath: true,
  port: 4567,
  enableTypeScriptWatch: true,
  watchDir: "./src",
});
```

```
bun run devserver.ts
```
