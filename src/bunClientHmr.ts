import type { BunHMROptions } from "./bunHmrPlugin";



function hotReload() {
  if (!(window as any).BUN_DEV_SERVER) {
    (window as any).BUN_DEV_SERVER = [];
  }
  const devServer = "[Bun Dev Server]";
  const connectAddress = "[REPLACE_ENDPOINT]";
  let foundServer = (window as any).BUN_DEV_SERVER.find((server: any) => server.url === connectAddress);
  if (!foundServer) {
    foundServer = { url: connectAddress, socket: null };
  }
  if (foundServer.socket) {
    return;
  }
  console.log(devServer, "Connecting to Bun Dev Server at", connectAddress);
  foundServer.socket = new WebSocket(connectAddress);
  (window as any).BUN_DEV_SERVER.push(foundServer);

  function errorHandler(err: Event) {
    console.error(devServer, "ERROR", err);
  }
  function messageHandler(msg: MessageEvent<any>) {
    let parsed = msg.data;
    try {
      parsed = JSON.parse(msg.data);
    } catch (e) { }
    if (parsed?.type === "message") {
      console.log(devServer, parsed.message);
      return;
    }
    if (parsed?.type === "output") {
      console.table(devServer, parsed.message);
      return;
    }
    if (parsed?.type === "reload") {
      window.location.reload();
      return;
    }
    if (parsed?.type === "tscerror") {
      console.error(parsed.message);
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
  }

  function closeHandler(ev: CloseEvent) {
    console.warn(devServer, "Connection closed. Will retry in 5 seconds...");
    foundServer.socket?.removeEventListener("error", errorHandler);
    foundServer.socket?.removeEventListener("message", messageHandler);
    foundServer.socket?.removeEventListener("open", messageHandler);
    foundServer.socket?.removeEventListener("close", closeHandler);
    foundServer.socket = null;
    setTimeout(function () {
      console.log(devServer, "Attempting to reconnect...");
      hotReload();
    }, 5000);
  }
  function openHandler(ev: Event) {
    console.log(devServer, "Connected to Bun Dev Server");
  }


  foundServer.socket.addEventListener("error", errorHandler)
  foundServer.socket.addEventListener("message", messageHandler);
  foundServer.socket.addEventListener("close", closeHandler);
  foundServer.socket.addEventListener("open", openHandler)

}

export const DEFAULT_HMR_PATH = "/hmr-ws";
export function bunHotReload(bunServerConfig: BunHMROptions) {
  const socketPath = bunServerConfig.websocketPath || DEFAULT_HMR_PATH;
  const endPath = socketPath.startsWith("/") ? socketPath : `/${socketPath}`;
  const path = `${(bunServerConfig.secure ? "wss" : "ws")}://localhost:${bunServerConfig.port}${endPath}`;
  return hotReload.toString().replace("[REPLACE_ENDPOINT]", path);
}
