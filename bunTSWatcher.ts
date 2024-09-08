import { $, type Server, type Subprocess, resolve } from "bun";
export async function startTSWatcher(server: Server, watchDir: URL) {
    let dstcwd: string | undefined;
    if (watchDir) {
        dstcwd = process.platform === "win32" ? watchDir.pathname.substring(1) : watchDir.pathname;
    }

    console.log("Starting TypeScript watcher in", dstcwd);
    // var tscResolved = await resolve("tsc", import.meta.dir);
    //const tsc = await $`bun run ${tscResolved} --noEmit --watch ${dstcwd}/*.ts`.quiet().arrayBuffer();
    let tsc: Subprocess | undefined;
    try {
        tsc = Bun.spawn(["tsc", "--watch", "--project", `${import.meta.dir}/tsconfig.json`], { stdout: "pipe", stderr: "pipe" });
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
    // if (!Bun.stdout.readable.locked) {
    //     const tscErrorReader = Bun.stdout.readable.getReader();

    //     // tsc.stdout.pipeThrough(new TextDecoderStream());
    //     tscErrorReader.read().then(async function processResult(stdoutresult) {
    //         if (stdoutresult.value) {
    //             const strVal = Buffer.from(stdoutresult.value).toString();
    //             const isError = /Found [1-9]\d* errors?\./.test(strVal);
    //             const isNoError = /Found 0 errors?\./.test(strVal);
    //             const isErrorLine = /error TS/.test(strVal);
    //             let msgType = "message";
    //             if (isError || isErrorLine) {
    //                 console.error(new Error(strVal));
    //                 msgType = "error";
    //                 //await Bun.write(Bun.stderr, stdoutresult.value);
    //             } else {
    //                 console.log(strVal);
    //             }
    //             server.publish("message", JSON.stringify({ type: msgType, message: strVal }));
    //             if(isNoError) {
    //                 server.publish("message", JSON.stringify({ type: "reload", message: "" }));
    //             }
    //             // const resVal = result.value;
    //             // const strVal = Buffer.from(result.value).toString();
    //             // await Bun.write(Bun.stdout, stdoutresult.value);
    //             // const result = strVal.indexOf("error") !== -1 ? new Error(strVal) : strVal;
    //             // console.log(Bun.inspect(result, {colors: true}));
    //             // Bun.stdout.writer().write();
    //         }
    //         if (stdoutresult.done) {
    //             return;
    //         }
    //         tscErrorReader.read().then(processResult);
    //     });
    // }
}