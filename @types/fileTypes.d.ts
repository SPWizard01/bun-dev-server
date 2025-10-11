declare module "*.ejs" {
  const template: string;
  export default template;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}
// export {};