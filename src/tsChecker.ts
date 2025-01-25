import type { BunDevServerConfig } from "./bunServeConfig";
import pc from "picocolors";
import { $ } from "bun";

export async function performTSC(finalConfig: BunDevServerConfig, importMeta: ImportMeta) {
    if (finalConfig.enableTSC) {
        console.log("Performing TSC check");
        const tsc = (await $`tsc --noEmit --noErrorTruncation -p ${finalConfig.tscConfigPath}`.cwd(importMeta.dir).quiet().nothrow());
        if (tsc.exitCode === 0) {
            console.log(pc.bgGreen("✔ [SUCCESS]"), "TSC check passed");
            return true;
        } else {
            console.log(pc.bgRed("✘ [ERROR]"), `\r\n${tsc.stdout.toString()}`);
            return false;
        }
    }
    return true;
}