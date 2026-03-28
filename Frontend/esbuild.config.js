const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const outdir = path.resolve(__dirname, "dist");
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

const shared = {
  bundle: true,
  minify: false,
  sourcemap: false,
  target: ["chrome120"],
  outdir,
  absWorkingDir: __dirname,
};

Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [path.resolve(__dirname, "src/popup/popup.ts")],
    outdir,
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.resolve(__dirname, "src/content/content.ts")],
    outdir,
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.resolve(__dirname, "src/background/background.ts")],
    outdir,
  }),
]).then(() => {
  return fs.promises.copyFile(
    path.resolve(__dirname, "src/popup/popup.css"),
    path.resolve(outdir, "popup.css")
  );
}).then(() => {
  console.log("Build complete → dist/");
}).catch((e) => {
  console.error(e);
  process.exit(1);
});