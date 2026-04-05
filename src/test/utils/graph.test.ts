import * as assert from 'assert';
import * as vscode from 'vscode';
import { nodeLabel, nodeColor, buildGraphData } from '../../utils/graph';
import { Mark, MarkArgs } from '../../utils/mark';

suite('graph', () => {
	const markArgs: MarkArgs = {
		file: 'src/example.ts',
		startLine: 10,
		endLine: 24,
		link: 'code-trail:src/example.ts#L10-L24',
		exportedAt: new Date('2026-03-22T12:34:56Z'),
	};

	suite('nodeLabel', () => {
		test('should return file#range when no symbol', () => {
			assert.strictEqual(
				nodeLabel(new Mark(markArgs)),
				'src/example.ts#L10-L24',
			);
		});

		test('should append () for function', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'foo', symbolKind: 'function' }),
				),
				'foo()',
			);
		});

		test('should append () for method', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'Foo.bar', symbolKind: 'method' }),
				),
				'Foo.bar()',
			);
		});

		test('should append () for constructor', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({
						...markArgs,
						symbol: 'Foo.constructor',
						symbolKind: 'constructor',
					}),
				),
				'Foo.constructor()',
			);
		});

		test('should prepend kind for class', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'Foo', symbolKind: 'class' }),
				),
				'class Foo',
			);
		});

		test('should prepend kind for struct', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'Point', symbolKind: 'struct' }),
				),
				'struct Point',
			);
		});

		test('should prepend kind for enum', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'Color', symbolKind: 'enum' }),
				),
				'enum Color',
			);
		});

		test('should return symbol name for interface', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({
						...markArgs,
						symbol: 'Readable',
						symbolKind: 'interface',
					}),
				),
				'interface Readable',
			);
		});

		test('should prepend kind for const', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'MAX_SIZE', symbolKind: 'const' }),
				),
				'const MAX_SIZE',
			);
		});

		test('should return symbol name for other kind', () => {
			assert.strictEqual(
				nodeLabel(
					new Mark({ ...markArgs, symbol: 'MAX_SIZE', symbolKind: 'other' }),
				),
				'MAX_SIZE',
			);
		});
	});

	const defaultCfg = { tabSize: 4, tabSizeByLanguage: {}, symbolColors: {} };

	suite('nodeColor', () => {
		test('should return blue for function/method/constructor', () => {
			const color = nodeColor(defaultCfg, 'function');
			assert.strictEqual(nodeColor(defaultCfg, 'method'), color);
			assert.strictEqual(nodeColor(defaultCfg, 'constructor'), color);
		});

		test('should return green for class/struct', () => {
			const color = nodeColor(defaultCfg, 'class');
			assert.strictEqual(nodeColor(defaultCfg, 'struct'), color);
		});

		test('should return different colors for each group', () => {
			const colors = new Set([
				nodeColor(defaultCfg, 'function'),
				nodeColor(defaultCfg, 'class'),
				nodeColor(defaultCfg, 'enum'),
				nodeColor(defaultCfg, 'interface'),
				nodeColor(defaultCfg, 'const'),
				nodeColor(defaultCfg, undefined),
			]);
			assert.strictEqual(colors.size, 6);
		});

		test('should return default color for undefined', () => {
			assert.strictEqual(
				nodeColor(defaultCfg, undefined),
				nodeColor(defaultCfg, 'unknown'),
			);
		});
	});

	suite('buildGraphData', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

		const markArgsA: MarkArgs = {
			file: 'src/a.ts',
			startLine: 1,
			endLine: 5,
			link: 'code-trail:src/a.ts#L1-L5',
			exportedAt: new Date('2026-03-22T12:34:56Z'),
			symbol: 'a',
			symbolKind: 'function',
			code: 'function a() {}',
		};

		const markArgsB: MarkArgs = {
			file: 'src/b.ts',
			startLine: 1,
			endLine: 3,
			link: 'code-trail:src/b.ts#L1-L3',
			exportedAt: new Date('2026-03-22T12:35:00Z'),
			symbol: 'b',
			symbolKind: 'function',
			code: 'function b() {}',
		};

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should return nodes and edges from marks', async () => {
			const markA = new Mark(markArgsA);
			const uriA = await markA.save();
			const markB = new Mark(markArgsB);
			const uriB = await markB.save();

			await markA.connect('uses', markB.id);

			const data = await buildGraphData();
			assert.strictEqual(data.nodes.length, 2);
			assert.strictEqual(data.edges.length, 1);
			assert.strictEqual(data.edges[0].from, uriA.fsPath.split('/').pop());
			assert.strictEqual(data.edges[0].to, uriB.fsPath.split('/').pop());
		});

		test('should return empty graph when no marks exist', async () => {
			const data = await buildGraphData();
			assert.strictEqual(data.nodes.length, 0);
			assert.strictEqual(data.edges.length, 0);
		});
	});
});
