import { bla } from "./something"
import { SPBrowser, spfi } from "@pnp/sp"
import { BearerToken } from "@pnp/queryable"

bla();
spfi("").using(SPBrowser(), BearerToken("")); 
console.log("App is aaaa!@");
const {bla2} = await import("./services/someservice");
bla2();