import type { BunDevServerConfig } from "./bunServeConfig";
import pc from "picocolors";
import { $ } from "bun";
const success = {
    error: false,
    message: ""
};
export async function performTSC(finalConfig: BunDevServerConfig, importMeta: ImportMeta) {
    if (finalConfig.enableTSC) {
        console.log("Performing TSC check");
        const tsc = (await $`tsc --noEmit --noErrorTruncation -p ${finalConfig.tscConfigPath}`.cwd(importMeta.dir).quiet().nothrow());
        if (tsc.exitCode === 0) {
            console.log(pc.bgGreen("✔ [SUCCESS]"), "TSC check passed");
            return success;
        } else {
            const errOutput = tsc.stdout.toString();
            console.log(pc.bgRed("✘ [ERROR]"), `\r\n${errOutput}`);
            return {
                error: true,
                message: errOutput
            };
        }
    }
    return success;
}