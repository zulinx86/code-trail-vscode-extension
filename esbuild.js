const esbuild = require('esbuild');

const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(
					`    ${location.file}:${location.line}:${location.column}:`,
				);
			});
			console.log('[watch] build finished');
		});
	},
};

const copyWebviewPlugin = {
	name: 'copy-webview',
	setup(build) {
		build.onEnd(() => {
			const src = path.join(__dirname, 'src', 'webview');
			const dest = path.join(__dirname, 'dist', 'webview');
			fs.mkdirSync(dest, { recursive: true });
			for (const file of fs.readdirSync(src)) {
				fs.copyFileSync(path.join(src, file), path.join(dest, file));
			}
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode', 'vis-network', 'vis-data'],
		logLevel: 'silent',
		plugins: [copyWebviewPlugin, esbuildProblemMatcherPlugin],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
