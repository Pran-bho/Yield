const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");
const shared = { bundle: true, sourcemap: true, target: "firefox109" };

async function build() {
  const contexts = await Promise.all([
    esbuild.context({ ...shared, entryPoints: ["src/popup/popup.ts"], outfile: "dist/popup.js" }),
    esbuild.context({ ...shared, entryPoints: ["src/content/content.ts"], outfile: "dist/content.js" }),
    esbuild.context({ ...shared, entryPoints: ["src/background/background.ts"], outfile: "dist/background.js" }),
  ]);

  if (isWatch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("[Yield] Watching for changes...");
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild().then(() => ctx.dispose())));
    console.log("[Yield] Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
