import * as assert from 'assert';
import * as vscode from 'vscode';
import { workspaceFolder } from '../../config';
import {
	MarkHelper,
	Connect,
	ConnectSuggestion,
	ConnectSuggestions,
} from '../../utils/connect';
import { Mark } from '../../utils/mark';
import type { MarkArgs } from '../../utils/mark';
import { openFixture, waitForSymbols } from '../helpers';

suite('connect', () => {
	suite('Connect.scanForSymbols', () => {
		test('should match whole symbol names', () => {
			const code = 'do_read(buf, len);';
			const result = Connect.scanForSymbols(code, ['do_read']);
			assert.strictEqual(result.size, 1);
			assert.strictEqual(result.get('do_read'), 0);
		});

		test('should not match partial symbol names', () => {
			const code = 'do_read_async(buf);';
			const result = Connect.scanForSymbols(code, ['do_read']);
			assert.strictEqual(result.size, 0);
		});

		test('should return first occurrence offset', () => {
			const code = 'x = foo(); y = foo();';
			const result = Connect.scanForSymbols(code, ['foo']);
			assert.strictEqual(result.size, 1);
			assert.strictEqual(result.get('foo'), 4);
		});

		test('should match multiple different symbols', () => {
			const code = 'foo(); bar(); baz();';
			const result = Connect.scanForSymbols(code, ['foo', 'bar']);
			assert.strictEqual(result.size, 2);
			assert.ok(result.has('foo'));
			assert.ok(result.has('bar'));
		});

		test('should return empty map for empty code', () => {
			const result = Connect.scanForSymbols('', ['foo']);
			assert.strictEqual(result.size, 0);
		});

		test('should return empty map for empty candidates', () => {
			const result = Connect.scanForSymbols('foo(); bar();', []);
			assert.strictEqual(result.size, 0);
		});
	});

	const markArgs: MarkArgs = {
		file: 'src/a.ts',
		startLine: 10,
		endLine: 24,
		link: 'code-trail:src/a.ts#L10-L24',
		exportedAt: new Date('2026-03-22T12:34:56Z'),
	};

	suite('MarkHelper.keys', () => {
		test('should include name key and range key when symbol exists', () => {
			const mark = new Mark({ ...markArgs, symbol: 'foo' });
			const keys = new MarkHelper(mark).keys;
			assert.ok(keys.includes('src/a.ts#foo'));
			assert.ok(keys.includes('src/a.ts#L10-L24'));
			assert.strictEqual(keys.length, 2);
		});

		test('should use last segment for qualified symbol', () => {
			const mark = new Mark({ ...markArgs, symbol: 'impl Foo.bar' });
			const keys = new MarkHelper(mark).keys;
			assert.ok(keys.includes('src/a.ts#bar'));
			assert.ok(keys.includes('src/a.ts#L10-L24'));
			assert.strictEqual(keys.length, 2);
		});

		test('should return only range key when no symbol', () => {
			const mark = new Mark(markArgs);
			const keys = new MarkHelper(mark).keys;
			assert.deepStrictEqual(keys, ['src/a.ts#L10-L24']);
		});
	});

	suite('MarkHelper.description', () => {
		test('should show symbol (file) when symbol exists', () => {
			const mark = new Mark({ ...markArgs, symbol: 'handleRequest' });
			assert.strictEqual(
				new MarkHelper(mark).description,
				'handleRequest (src/a.ts)',
			);
		});

		test('should show file#range when no symbol', () => {
			const mark = new Mark(markArgs);
			assert.strictEqual(new MarkHelper(mark).description, 'src/a.ts#L10-L24');
		});
	});

	suite('Connect.getCalls', () => {
		test('should detect outgoing calls', async function () {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const callerMark = new Mark({
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 30,
				endLine: 32,
				symbol: 'myCaller',
				code: 'function myCaller() {\n  myCallee();\n}',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L30-L32',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const calleeMark = new Mark({
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 26,
				endLine: 28,
				symbol: 'myCallee',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L26-L28',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const { outgoing } = await new Connect(callerMark).getCalls([calleeMark]);
			const keys = [...outgoing];
			assert.ok(
				keys.some((k) => k.includes('myCallee')),
				`outgoing should contain myCallee, got: [${keys.join(', ')}]`,
			);
		});

		test('should detect incoming calls', async function () {
			this.timeout(10000);
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const calleeMark = new Mark({
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 26,
				endLine: 28,
				symbol: 'myCallee',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L26-L28',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const callerMark = new Mark({
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 30,
				endLine: 32,
				symbol: 'myCaller',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L30-L32',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const { incoming } = await new Connect(calleeMark).getCalls([callerMark]);
			const keys = [...incoming];
			assert.ok(
				keys.some((k) => k.includes('myCaller')),
				`incoming should contain myCaller, got: [${keys.join(', ')}]`,
			);
		});

		test('should return empty sets when symbol not found', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const mark = new Mark({
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 1,
				endLine: 1,
				symbol: 'doesNotExist',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L1-L1',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const { outgoing, incoming } = await new Connect(mark).getCalls([]);
			assert.strictEqual(outgoing.size, 0);
			assert.strictEqual(incoming.size, 0);
		});
	});

	suite('Connect.getSuggestions', () => {
		const markA = new Mark({ ...markArgs, symbol: 'foo' });
		const markB = new Mark({
			...markArgs,
			file: 'src/b.ts',
			symbol: 'bar',
			link: 'code-trail:src/b.ts#L10-L24',
		});
		const markC = new Mark({
			...markArgs,
			file: 'src/c.ts',
			symbol: 'baz',
			link: 'code-trail:src/c.ts#L10-L24',
		});

		test('should mark outgoing matches as suggested uses', () => {
			const connect = new Connect(markA);
			const outgoing = new Set(['src/b.ts#bar']);
			const incoming = new Set<string>();
			const suggestions = connect.getSuggestions([markB], outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);
			assert.strictEqual(suggested.length, 1);
			assert.strictEqual(suggested[0].direction, 'uses');
			assert.strictEqual(suggested[0].mark.id, markB.id);
		});

		test('should mark incoming matches as suggested usedBy', () => {
			const connect = new Connect(markA);
			const outgoing = new Set<string>();
			const incoming = new Set(['src/b.ts#bar']);
			const suggestions = connect.getSuggestions([markB], outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);
			assert.strictEqual(suggested.length, 1);
			assert.strictEqual(suggested[0].direction, 'usedBy');
			assert.strictEqual(suggested[0].mark.id, markB.id);
		});

		test('should mark non-matching as not suggested', () => {
			const connect = new Connect(markA);
			const outgoing = new Set<string>();
			const incoming = new Set<string>();
			const suggestions = connect.getSuggestions([markB], outgoing, incoming);
			assert.strictEqual(suggestions.length, 1);
			assert.strictEqual(suggestions[0].suggested, false);
		});

		test('should handle both outgoing and incoming for same mark', () => {
			const connect = new Connect(markA);
			const outgoing = new Set(['src/b.ts#bar']);
			const incoming = new Set(['src/b.ts#bar']);
			const suggestions = connect.getSuggestions([markB], outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);
			assert.strictEqual(suggested.length, 2);
			assert.ok(suggested.some((s) => s.direction === 'uses'));
			assert.ok(suggested.some((s) => s.direction === 'usedBy'));
		});

		test('should include all marks with correct suggested flags', () => {
			const connect = new Connect(markA);
			const outgoing = new Set(['src/b.ts#bar']);
			const incoming = new Set<string>();
			const suggestions = connect.getSuggestions(
				[markB, markC],
				outgoing,
				incoming,
			);
			assert.strictEqual(suggestions.length, 2);
			assert.strictEqual(suggestions.filter((s) => s.suggested).length, 1);
			assert.strictEqual(suggestions.filter((s) => !s.suggested).length, 1);
		});
	});

	suite('ConnectionSuggestions.toQuickPickItems', () => {
		const markA = new Mark({ ...markArgs, symbol: 'foo' });
		const markB = new Mark({
			...markArgs,
			file: 'src/b.ts',
			link: 'code-trail:src/b.ts#L10-L24',
		});

		test('should place suggested items before others', () => {
			const suggestions = new ConnectSuggestions([
				new ConnectSuggestion({
					mark: markB,
					direction: 'uses' as const,
					description: 'src/b.ts#L10-L24',
					suggested: false,
				}),
				new ConnectSuggestion({
					mark: markA,
					direction: 'uses' as const,
					description: 'foo (src/example.ts)',
					suggested: true,
				}),
			]);
			const items = suggestions.toQuickPickItems();
			assert.ok(items[0].detail === 'Suggested');
			assert.ok(!items[1].detail);
		});

		test('should use arrow-right for uses and arrow-left for usedBy', () => {
			const suggestions = new ConnectSuggestions([
				new ConnectSuggestion({
					mark: markA,
					direction: 'uses' as const,
					description: 'foo',
					suggested: true,
				}),
				new ConnectSuggestion({
					mark: markB,
					direction: 'usedBy' as const,
					description: 'bar',
					suggested: true,
				}),
			]);
			const items = suggestions.toQuickPickItems();
			assert.ok(items[0].label.includes('$(arrow-right)'));
			assert.ok(items[1].label.includes('$(arrow-left)'));
		});

		test('should return empty array for empty suggestions', () => {
			const items = new ConnectSuggestions([]).toQuickPickItems();
			assert.strictEqual(items.length, 0);
		});
	});

	suite('Connect.prompt', () => {
		const workspaceUri = workspaceFolder!.uri;
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

		test('should add bidirectional connections when a mark is selected', async () => {
			const markA = new Mark(markArgsA);
			const uriA = await markA.save();
			const uriB = await new Mark(markArgsB).save();
			const markIdA = uriA.fsPath.split('/').pop()!;
			const markIdB = uriB.fsPath.split('/').pop()!;

			const origShowQuickPick = vscode.window.showQuickPick;
			let callCount = 0;
			(vscode.window as any).showQuickPick = async (items: any[]) => {
				callCount++;
				// Select mark B for the first call
				if (callCount === 1) {
					return items.find((i: any) => i.description === markIdB);
				}
				// Select "uses" for the second call
				return items.find((i: any) => i.value === 'uses');
			};

			try {
				await new Connect(markA).prompt();
				// Now the connection where mark A uses mark B should be established.

				const textA = Buffer.from(
					await vscode.workspace.fs.readFile(uriA),
				).toString('utf-8');
				assert.ok(
					textA.includes(`uses:\n  - code-trail:code-trail/${markIdB}`),
				);

				const textB = Buffer.from(
					await vscode.workspace.fs.readFile(uriB),
				).toString('utf-8');
				assert.ok(
					textB.includes(`usedBy:\n  - code-trail:code-trail/${markIdA}`),
				);
			} finally {
				(vscode.window as any).showQuickPick = origShowQuickPick;
			}
		});

		test('should do nothing when quick pick is cancelled', async () => {
			const markA = new Mark(markArgsA);
			const uriA = await markA.save();
			const uriB = await new Mark(markArgsB).save();

			const origShowQuickPick = vscode.window.showQuickPick;
			(vscode.window as any).showQuickPick = async () => undefined; // Do nothing

			try {
				await new Connect(markA).prompt();
				// No connections should be established.

				const textA = Buffer.from(
					await vscode.workspace.fs.readFile(uriA),
				).toString('utf-8');
				assert.ok(!textA.includes('uses:'));

				const textB = Buffer.from(
					await vscode.workspace.fs.readFile(uriB),
				).toString('utf-8');
				assert.ok(!textB.includes('usedBy:'));
			} finally {
				(vscode.window as any).showQuickPick = origShowQuickPick;
			}
		});

		test('should do nothing when no other marks exist', async () => {
			const markA = new Mark(markArgsA);
			const uriA = await markA.save();

			const originalContent = Buffer.from(
				await vscode.workspace.fs.readFile(uriA),
			).toString('utf-8');

			await new Connect(markA).prompt();

			const content = Buffer.from(
				await vscode.workspace.fs.readFile(uriA),
			).toString('utf-8');
			assert.strictEqual(content, originalContent);
		});
	});
});
