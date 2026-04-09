import * as assert from 'assert';
import * as vscode from 'vscode';
import { workspaceFolder } from '../../config';
import { Graph, GraphConfig, GraphFonts } from '../../utils/graph';
import { Mark, MarkArgs } from '../../utils/mark';

suite('graph', () => {
	const cfg = new GraphConfig(new GraphFonts(18, 20, 32, 14), 4, {}, {});

	suite('GraphConfig.colorForSymbolKind', () => {
		test('should return blue for function/method/constructor', () => {
			const color = cfg.colorForSymbolKind('function');
			assert.strictEqual(cfg.colorForSymbolKind('method'), color);
			assert.strictEqual(cfg.colorForSymbolKind('constructor'), color);
		});

		test('should return green for class/struct', () => {
			const color = cfg.colorForSymbolKind('class');
			assert.strictEqual(cfg.colorForSymbolKind('struct'), color);
		});

		test('should return different colors for each group', () => {
			const colors = new Set([
				cfg.colorForSymbolKind('function'),
				cfg.colorForSymbolKind('class'),
				cfg.colorForSymbolKind('enum'),
				cfg.colorForSymbolKind('interface'),
				cfg.colorForSymbolKind('const'),
				cfg.colorForSymbolKind(undefined),
			]);
			assert.strictEqual(colors.size, 6);
		});

		test('should return default color for undefined', () => {
			assert.strictEqual(
				cfg.colorForSymbolKind(undefined),
				cfg.colorForSymbolKind('unknown'),
			);
		});
	});

	const markArgs: MarkArgs = {
		file: 'src/example.ts',
		startLine: 10,
		endLine: 24,
		link: 'code-trail:src/example.ts#L10-L24',
		exportedAt: new Date('2026-03-22T12:34:56Z'),
	};

	suite('Graph.getHeader', () => {
		test('should return file#range when no symbol', () => {
			assert.strictEqual(
				Graph.getHeader(new Mark(markArgs)),
				'src/example.ts#L10-L24',
			);
		});

		test('should append () for function', () => {
			assert.strictEqual(
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'foo', symbolKind: 'function' }),
				),
				'foo()',
			);
		});

		test('should append () for method', () => {
			assert.strictEqual(
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'Foo.bar', symbolKind: 'method' }),
				),
				'Foo.bar()',
			);
		});

		test('should append () for constructor', () => {
			assert.strictEqual(
				Graph.getHeader(
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
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'Foo', symbolKind: 'class' }),
				),
				'class Foo',
			);
		});

		test('should prepend kind for struct', () => {
			assert.strictEqual(
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'Point', symbolKind: 'struct' }),
				),
				'struct Point',
			);
		});

		test('should prepend kind for enum', () => {
			assert.strictEqual(
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'Color', symbolKind: 'enum' }),
				),
				'enum Color',
			);
		});

		test('should return symbol name for interface', () => {
			assert.strictEqual(
				Graph.getHeader(
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
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'MAX_SIZE', symbolKind: 'const' }),
				),
				'const MAX_SIZE',
			);
		});

		test('should return symbol name for other kind', () => {
			assert.strictEqual(
				Graph.getHeader(
					new Mark({ ...markArgs, symbol: 'MAX_SIZE', symbolKind: 'other' }),
				),
				'MAX_SIZE',
			);
		});
	});

	suite('buildGraphData', () => {
		const workspaceUri = workspaceFolder!.uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

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

		test('should return nodes and edges from marks', async () => {
			const markA = new Mark(markArgsA);
			await markA.save();
			const markB = new Mark(markArgsB);
			await markB.save();

			await markA.connect('uses', markB.id);

			const marks = await Mark.getAll();
			const graph = Graph.fromMarks(marks);
			assert.strictEqual(graph.data.nodes.length, 2);
			assert.strictEqual(graph.data.edges.length, 1);
			assert.strictEqual(graph.data.edges[0].from, markA.id);
			assert.strictEqual(graph.data.edges[0].to, markB.id);
		});

		test('should return empty graph when no marks exist', async () => {
			const graph = Graph.fromMarks([]);
			assert.strictEqual(graph.data.nodes.length, 0);
			assert.strictEqual(graph.data.edges.length, 0);
		});

		test('should order target nodes by uses declaration order', async () => {
			const markArgsC: MarkArgs = {
				file: 'src/c.ts',
				startLine: 1,
				endLine: 3,
				link: 'code-trail:src/c.ts#L1-L3',
				exportedAt: new Date('2026-03-22T12:35:04Z'),
				symbol: 'c',
				symbolKind: 'function',
				code: 'function c() {}',
			};

			const markA = new Mark(markArgsA);
			const markB = new Mark(markArgsB);
			const markC = new Mark(markArgsC);
			await markA.save();
			await markB.save();
			await markC.save();

			// A uses B then C — B should appear above C in the graph.
			await markA.connect('uses', markB.id);
			await markA.connect('uses', markC.id);

			const marks = await Mark.getAll();
			const graph = Graph.fromMarks(marks);

			const nodeB = graph.data.nodes.find((n) => n.id === markB.id)!;
			const nodeC = graph.data.nodes.find((n) => n.id === markC.id)!;
			assert.ok(
				nodeB.y < nodeC.y,
				`B.y (${nodeB.y}) should be less than C.y (${nodeC.y})`,
			);
		});
	});
});
