import { bla } from "./something"

bla();
const app = window.document.querySelector("#app");
if(app) {
    app.textContent = "Hello World";
}
const {bla2} = await import("./services/someservice");
bla2();

