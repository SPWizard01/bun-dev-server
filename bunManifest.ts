import { type BuildOutput, write, pathToFileURL } from "bun";
export function writeManifest(output: BuildOutput, outdir: string, manifestName = "manifest.txt") {
    const entryPoints = output.outputs.filter(o => o.kind === "entry-point");
    const epTable = [];
    for (const ep of entryPoints) {
        const basePathUrl = pathToFileURL(outdir);
        const epUrl = pathToFileURL(ep.path);
        const relativePath = epUrl.href.replace(`${basePathUrl.href}/`, "");
        const nameNoJs = relativePath.replace(".js", "");
        const hashedImport = `${relativePath}?${ep.hash}`;
        epTable.push({ name: nameNoJs, path: hashedImport });
    }
    const outObj = {};
    for (const element of epTable) {
        Object.assign(outObj, { [element.name]: { js: [`${element.path}`] } });
    }
    write(`${outdir}/${manifestName}`, JSON.stringify(outObj));
}