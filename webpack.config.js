const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const {EsbuildPlugin} = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const yazl = require("yazl");
const pluginManifest = require("./plugin.json");

// Clean stale chunks and obsolete build artifacts before compilation
if (fs.existsSync(path.join(__dirname, "dist"))) {
    for (const file of fs.readdirSync(path.join(__dirname, "dist"))) {
        if (file.endsWith(".js") || file.endsWith(".map") || file.endsWith(".css")) {
            try { fs.unlinkSync(path.join(__dirname, "dist", file)); } catch { /* ignore */ }
        }
    }
}

class PackageZipPlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap("PackageZipPlugin", (compilation) => {
            compilation.hooks.processAssets.tapPromise(
                {
                    name: "PackageZipPlugin",
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
                },
                async () => {
                    const entries = compilation.getAssets()
                        .filter((asset) => !asset.name.endsWith(".zip") && !asset.name.startsWith("../"))
                        .sort((left, right) => left.name.localeCompare(right.name));
                    const archive = await createZip(entries.map((asset) => ({
                        name: asset.name,
                        content: asset.source.source(),
                    })));
                    compilation.emitAsset("../package.zip", new webpack.sources.RawSource(archive));
                },
            );
        });
    }
}

function createZip(entries) {
    return new Promise((resolve, reject) => {
        const zip = new yazl.ZipFile();
        const chunks = [];
        /* 固定确定性构建时间戳（2026-11-24 零点），既保证 mtime 处于最新版本时期（彻底消除 1980 纪元被 WebDAV 旧版本覆盖的风险），
           又彻底杜绝多次构建产生不同的 zip SHA-256 摘要，使 fresh build + check:release 100% 幂等可重现。 */
        const buildTime = new Date("2026-11-24T00:00:00.000Z");
        zip.outputStream.on("data", (chunk) => chunks.push(chunk));
        zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
        zip.outputStream.on("error", reject);
        entries.forEach((entry) => zip.addBuffer(Buffer.from(entry.content), entry.name, {mtime: buildTime}));
        zip.end();
    });
}

module.exports = (env, argv) => {
    const production = argv.mode === "production";
    const plugins = [
        new MiniCssExtractPlugin({
            filename: "index.css",
        }),
        new CopyPlugin({
            patterns: production ? [
                {from: "plugin.json", to: "./plugin.json"},
                {from: "README.md", to: "./README.md"},
                {from: "README_en.md", to: "./README_en.md"},
                {from: "LICENSE", to: "./LICENSE.txt"},
                {from: "i18n", to: "./i18n"},
                {from: "public/lv-kit-*.js", to: "./[name][ext]"},
                {from: "public/lv-sponsor-card.png", to: "./[name][ext]"},
                {from: pluginManifest.icon, to: `./${pluginManifest.icon}`},
                ...(pluginManifest.preview ? [{from: pluginManifest.preview, to: `./${pluginManifest.preview}`}] : []),
            ] : [
                {from: "public/lv-kit-*.js", to: "./[name][ext]"},
                {from: "public/lv-sponsor-card.png", to: "./[name][ext]"},
                {from: pluginManifest.icon, to: `./${pluginManifest.icon}`},
                ...(pluginManifest.preview ? [{from: pluginManifest.preview, to: `./${pluginManifest.preview}`}] : []),
            ],
        }),
    ];

    if (production) {
        plugins.push(
            new webpack.BannerPlugin({
                banner: fs.existsSync("LICENSE") ? fs.readFileSync("LICENSE").toString() : "小驴打卡",
                // Keep the full license banner on executable output only. The
                // package already ships LICENSE.txt, so duplicating it in CSS
                // needlessly adds about 1 KiB to every build.
                include: /\.js$/,
                exclude: /^lv-kit-/,
            }),
        );
        // Validation builds share production output without creating an installable archive.
        if (!env?.noPackage) plugins.push(new PackageZipPlugin());
    }

    return {
        mode: argv.mode || "development",
        watch: false,
        devtool: production ? false : "eval-source-map",
        output: {
            filename: "index.js",
            chunkFilename: "[name].chunk.js",
            path: production ? path.resolve(__dirname, "dist") : path.resolve(__dirname),
            clean: Boolean(production),
            publicPath: "./",
            libraryTarget: "commonjs2",
            library: {type: "commonjs2"},
            globalObject: "globalThis",
        },
        externals: {
            siyuan: "siyuan",
        },
        entry: "./src/index.ts",
        optimization: {
            minimize: production,
            /* The extracted stylesheet is the largest release asset.  Sass
               already emits compressed CSS, but css-loader still preserves
               selector/value whitespace and duplicate-safe formatting.  The
               existing esbuild minimizer can process CSS assets as well;
               enabling it here keeps the hard release budget meaningful
               without changing source-level cascade or layout semantics. */
            minimizer: [new EsbuildPlugin({css: production})],
        },
        resolve: {
            extensions: [".ts", ".scss", ".js", ".json"],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [{loader: "esbuild-loader", options: {target: "es2020"}}],
                },
                {
                    test: /\.scss$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        MiniCssExtractPlugin.loader,
                        "css-loader",
                        {
                            loader: "sass-loader",
                            options: {
                                /* Production CSS is shipped as a single asset. Sass's
                                   compressed emitter removes comments/whitespace without
                                   changing selectors or runtime layout, keeping the release
                                   budget focused on actual UI rules. Development stays
                                   expanded so visual debugging remains readable. */
                                sassOptions: {outputStyle: production ? "compressed" : "expanded"},
                            },
                        },
                    ],
                },
            ],
        },
        plugins,
    };
};
