import type { BunDevServerConfig } from "./bunServeConfig";
import pc from "picocolors";
import { $ } from "bun";

export async function performTSC(finalConfig: BunDevServerConfig) {
    if (finalConfig.enableTSC) {
        console.log("Performing TSC check");
        const tsc = (await $`tsc`.nothrow().quiet());
        if (tsc.exitCode === 0) {
            console.log(pc.bgGreen("✔ [SUCCESS]"), "TSC check passed");
        } else {
            console.log(pc.bgRed("✘ [ERROR]"), `\r\n${tsc.stdout.toString()}`);
        }
    }
}