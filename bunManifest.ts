import { type BuildOutput, write, pathToFileURL } from "bun";
export function writeManifest(output: BuildOutput, outdir: string, withHash = false, manifestName = "bunmanifest.txt") {
    const entryPoints = output.outputs.filter(o => o.kind === "entry-point");
    const epTable: string[] = [];
    for (const ep of entryPoints) {
        const basePathUrl = pathToFileURL(outdir);
        const epUrl = pathToFileURL(ep.path);
        const relativePath = epUrl.href.replace(`${basePathUrl.href}/`, "");
        // const nameNoJs = relativePath.replace(".js", "");
        const hashedImport = `${relativePath}${withHash ? `?${ep.hash}` : ``}`;
        epTable.push(hashedImport);
    }
    const outObj = { js: epTable };
    // for (const element of epTable) {
    //     Object.assign(outObj, { [element.name]: { js: [`${element.path}`] } });
    // }
    write(`${outdir}/${manifestName}`, JSON.stringify(outObj));
}