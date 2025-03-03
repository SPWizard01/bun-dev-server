# Bun Dev Server
A a dev server like Webpack dev server but only with bun, uses  internal server available from [Bun.serve()](https://bun.sh/docs/api/http#bun-serve)

Available at [NPM Repository](https://www.npmjs.com/package/bun-dev-server)

#### Bun
`bun i bun-dev-server`
#### Npm 
`npm i bun-dev-server`

## Example config
```ts
//devserver.ts
import { startBunDevServer } from "bun-dev-server";
import { file } from "bun";

startBunDevServer(
  {
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
    port: 44345,
    watchDir: "./src",
    hotReload: "plugin",
    writeManifest: false,
    cleanServePath: true,
    logRequests: true,
    reloadOnChange: true,
    watchDelay: 2000,
  },
  import.meta
);
```
Then
```
bun run devserver.ts
```

# Options
Options that are available for configuration
| **Option**             | **Required** | **Default**                          | **Description**                                                                                                                                                                                                    |
|------------------------|--------------|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| port | true | N/A | The port to run the server on. |
| buildConfig | true | N/A | The build configuration to use for the server. |
| watchDir | true | N/A | The directory to watch for changes. |
| watchDelay | false | 1000 | The delay in milliseconds to wait before starting <br> a new build once a file has changed.<br> Used in debounce function, in case many changes <br>happen in file system at once. |
| enableTSC | false | false | Whether to enable TypeScript checking <br>it will use `tscConfigPath` in your project directory. |
| tscConfigPath | false | `./tsconfig.json` | The path to the TypeScript configuration file. |
| writeManifest | false | false | Whether to write the manifest file. |
| manifestName | false | `bun_server_manifest.json`| The name of the manifest file. |
| manifestWithHash| false | false | Whether to include the hash with the entrypoints in the manifest file. |
| hotReload | false | none | Where to place hot reload script. Available values: "plugin" | "footer" | "none" |
| reloadOnChange | false | false |  Whether to reload the page when a file changes. <br> This requires property `hotReload` to be set<br> to `"plugin"` or `"footer"`. |
| logRequests | false | false | Whether to log HTTP requests to the console. |
| servePath | false | `outdir` in build config or `./dist` | The path to the directory to serve files from.<br> Takes precedence over `buildConfig.outdir`. |
| cleanServePath | false | false | Whether to clean the `servePath` before building a new batch. |
| serveOutputEjs | false | Built-in template | The EJS template used for <br> the output of the `/` path on the server. <br> When supplying your own template,<br> the properties that are provided during rendering <br>are `files` and `dirs` both are arrays. |
| serveIndexHtmlEjs | false | Built-in template | The EJS template used for the output of the `/index.html` path on the server. <br> When supplying your own template, <br>the property that is provided during rendering <br>is `hashedImports` that is an array of strings. |
| createIndexHTML | false | true | Whether to create index.html using `serveIndexHtmlEjs` template. |
| beforeBuild | false | undefined | Event listener to execute before Bun builds |
| afterBuild | false | undefined | Event listener to execute after Bun builds |
| tls | false | undefined | Secure options for the server. Forwards buns `TLSOptions` |
| websocketPath | false | `/hmr-ws` | The websocket path to use for the server. |
| static | false | undefined | Static bun responses, can be used for things like `/favicon.ico` etc. |
| waitForTSCSuccessBeforeReload | false | undefined | Whether to wait for the TypeScript check to finish before reloading the page. |
| broadcastBuildOutputToClient | false | `true` | Whether to broadcast the build output to the browser.
| broadcastBuildOutputToConsole | false | `true` | Whether to broadcast the build output to the console.
| broadcastTSCErrorToClient | false | undefined | Whether to broadcast the TypeScript check error to the client.