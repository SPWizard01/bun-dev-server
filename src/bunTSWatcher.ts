import { $, type Server, type Subprocess } from "bun";
export async function startTSWatcher(server: Server<any>, watchDir: URL) {
    let dstcwd = process.cwd();
    if (watchDir) {
        dstcwd = process.platform === "win32" ? watchDir.pathname.substring(1) : watchDir.pathname;
    }

    console.log("Starting TypeScript watcher in", dstcwd);
    // var tscResolved = await resolve("tsc", import.meta.dir);
    //const tsc = await $`bun run ${tscResolved} --noEmit --watch ${dstcwd}/*.ts`.quiet().arrayBuffer();
    let tsc: Subprocess | undefined;
    try {
        tsc = Bun.spawn(["tsc", "--watch", "--project", `${process.cwd()}/tsconfig.json`], { stdout: "pipe", stderr: "pipe", cwd: dstcwd });
    } catch (e) {
        console.error("TSC not found have you installed it globally?");
        return;
    }
    for await (const chunk of tsc.stdout as any) {
        const strVal = new TextDecoder().decode(chunk);
        const isError = /Found [1-9]\d* errors?\./.test(strVal);
        const isNoError = /Found 0 errors?\./.test(strVal);
        const isErrorLine = /error TS/.test(strVal);
        let msgType = "message";
        if (isError || isErrorLine) {
            console.error(strVal);
            msgType = "error";
        }
        else if (isNoError) {
            console.log("\x1b[32m", strVal, "\x1b[0m");
        }
        else {
            console.log(strVal);
        }
        server.publish("message", JSON.stringify({ type: msgType, message: strVal }));
        if (isNoError) {
            server.publish("message", JSON.stringify({ type: "reload", message: "" }));
        }
    }
}