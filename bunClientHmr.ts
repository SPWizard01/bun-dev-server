import { type BunDevServerSocketConfig } from "./bunServeConfig";

function hotReload() {
  const hmrSock = new WebSocket("[REPLACE_ENDPOINT]");
  hmrSock.addEventListener("error", (err) => {
    console.error("HMR ERROR", err);
  })
  hmrSock.addEventListener("message", (msg) => {
    let parsed = msg.data;
    try {
      parsed = JSON.parse(msg.data);
    } catch (e) { }
    if (parsed?.type === "message") {
      console.log(parsed.message);
      return;
    }
    if (parsed?.type === "output") {
      console.table(parsed.message);
      return;
    }
    if (parsed?.type === "reload") {
      window.location.reload();
      return;
    }
    if (parsed?.type === "error") {
      console.error(parsed.message);
      let newDiv = window.document.getElementById("bun-hmr-error")
      const divExists = !!newDiv;
      if (!newDiv) {
        newDiv = window.document.createElement("div");
      }
      newDiv.id = "bun-hmr-error";
      newDiv.innerText += parsed.message;
      if (!divExists) {

        window.document.body.appendChild(newDiv);
      }
      return;
    }
  });
}

export function bunHotReload(bunServerConfig: BunDevServerSocketConfig) {
  const endPath = bunServerConfig.websocketPath.startsWith("/") ? bunServerConfig.websocketPath : `/${bunServerConfig.websocketPath}`;
  const path = `${(bunServerConfig.tls ? "wss" : "ws")}://localhost:${bunServerConfig.port}${endPath}`;
  return hotReload.toString().replace("[REPLACE_ENDPOINT]", path);
}
