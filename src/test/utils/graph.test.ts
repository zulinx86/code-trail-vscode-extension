import * as assert from 'assert';
import * as vscode from 'vscode';
import { nodeLabel, nodeColor, buildGraphData } from '../../utils/graph';
import { saveMark } from '../../utils/mark';
import { addLink } from '../../utils/frontmatter';
import type { Frontmatter } from '../../utils/frontmatter';
import { Selection } from '../../utils/selection';

suite('graph', () => {
	const baseFm: Frontmatter = {
		file: 'src/example.ts',
		startLine: 10,
		endLine: 24,
		link: 'code-trail:src/example.ts#L10-L24',
		exportedAt: '2026-03-22T12:34:56Z',
	};

	suite('nodeLabel', () => {
		test('should return file#range when no symbol', () => {
			assert.strictEqual(nodeLabel(baseFm), 'src/example.ts#L10-L24');
		});

		test('should append () for function', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'foo', symbolKind: 'function' }),
				'foo()',
			);
		});

		test('should append () for method', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'Foo.bar', symbolKind: 'method' }),
				'Foo.bar()',
			);
		});

		test('should append () for constructor', () => {
			assert.strictEqual(
				nodeLabel({
					...baseFm,
					symbol: 'Foo.constructor',
					symbolKind: 'constructor',
				}),
				'Foo.constructor()',
			);
		});

		test('should prepend kind for class', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'Foo', symbolKind: 'class' }),
				'class Foo',
			);
		});

		test('should prepend kind for struct', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'Point', symbolKind: 'struct' }),
				'struct Point',
			);
		});

		test('should prepend kind for enum', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'Color', symbolKind: 'enum' }),
				'enum Color',
			);
		});

		test('should return symbol name for interface', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'Readable', symbolKind: 'interface' }),
				'interface Readable',
			);
		});

		test('should prepend kind for const', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'MAX_SIZE', symbolKind: 'const' }),
				'const MAX_SIZE',
			);
		});

		test('should return symbol name for other kind', () => {
			assert.strictEqual(
				nodeLabel({ ...baseFm, symbol: 'MAX_SIZE', symbolKind: 'other' }),
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

		const selectionA = new Selection(
			'src/a.ts',
			1,
			5,
			'function a() {}',
			'a',
			'function',
		);

		const selectionB = new Selection(
			'src/b.ts',
			1,
			3,
			'function b() {}',
			'b',
			'function',
		);

		const fixedDate = new Date('2026-03-22T12:34:56Z');

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should return nodes and edges from marks', async () => {
			const uriA = await saveMark(selectionA, fixedDate);
			const uriB = await saveMark(selectionB, new Date('2026-03-22T12:35:00Z'));

			await addLink(uriA, 'uses', `code-trail/${uriB.fsPath.split('/').pop()}`);

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
