import * as assert from 'assert';
import * as vscode from 'vscode';
import { nodeLabel, nodeColor, buildGraphData } from '../../utils/graph';
import { saveMark } from '../../utils/mark';
import { addLink } from '../../utils/frontmatter';
import type { Frontmatter } from '../../utils/frontmatter';
import type { SelectionInfo } from '../../utils/selection';

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

	suite('nodeColor', () => {
		test('should return blue for function/method/constructor', () => {
			const color = nodeColor('function');
			assert.strictEqual(nodeColor('method'), color);
			assert.strictEqual(nodeColor('constructor'), color);
		});

		test('should return green for class/struct', () => {
			const color = nodeColor('class');
			assert.strictEqual(nodeColor('struct'), color);
		});

		test('should return different colors for each group', () => {
			const colors = new Set([
				nodeColor('function'),
				nodeColor('class'),
				nodeColor('enum'),
				nodeColor('interface'),
				nodeColor('const'),
				nodeColor(undefined),
			]);
			assert.strictEqual(colors.size, 6);
		});

		test('should return default color for undefined', () => {
			assert.strictEqual(nodeColor(undefined), nodeColor('unknown'));
		});
	});

	suite('buildGraphData', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

		const infoA: SelectionInfo = {
			filePath: 'src/a.ts',
			fileName: 'a.ts',
			startLine: 1,
			endLine: 5,
			selectedText: 'function a() {}',
			languageId: 'typescript',
			symbol: 'a',
			symbolKind: 'function',
		};

		const infoB: SelectionInfo = {
			filePath: 'src/b.ts',
			fileName: 'b.ts',
			startLine: 1,
			endLine: 3,
			selectedText: 'function b() {}',
			languageId: 'typescript',
			symbol: 'b',
			symbolKind: 'function',
		};

		const fixedDate = new Date('2026-03-22T12:34:56Z');

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should return nodes and edges from marks', async () => {
			const uriA = await saveMark(infoA, fixedDate);
			const uriB = await saveMark(infoB, new Date('2026-03-22T12:35:00Z'));

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
