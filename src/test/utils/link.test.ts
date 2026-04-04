import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	markToKeys,
	markToDescription,
	getLinkSuggestions,
	getOutgoingAndIncomingCalls,
	callItemToNameKey,
	callItemToRangeKey,
	linkSuggestionsToQuickPickItems,
	promptAndLink,
} from '../../utils/link';
import { saveMark } from '../../utils/mark';
import { parseFrontmatter } from '../../utils/frontmatter';
import type { MarkInfo } from '../../utils/mark';
import type { Frontmatter } from '../../utils/frontmatter';
import { Selection } from '../../utils/selection';
import { openFixture, waitForSymbols } from '../helpers';

suite('link', () => {
	suite('callItemToNameKey', () => {
		test('should return file#name for item without detail', () => {
			const item = new vscode.CallHierarchyItem(
				vscode.SymbolKind.Function,
				'foo',
				'',
				vscode.Uri.file('/workspace/src/a.ts'),
				new vscode.Range(0, 0, 2, 0),
				new vscode.Range(0, 0, 0, 3),
			);
			assert.strictEqual(callItemToNameKey('/workspace', item), 'src/a.ts#foo');
		});

		test('should return file#name for item with detail', () => {
			const item = new vscode.CallHierarchyItem(
				vscode.SymbolKind.Method,
				'bar',
				'Foo',
				vscode.Uri.file('/workspace/src/a.ts'),
				new vscode.Range(1, 0, 3, 0),
				new vscode.Range(1, 0, 1, 3),
			);
			assert.strictEqual(callItemToNameKey('/workspace', item), 'src/a.ts#bar');
		});
	});

	suite('callItemToRangeKey', () => {
		test('should return file#L<start>-L<end> with 1-based line numbers', () => {
			const item = new vscode.CallHierarchyItem(
				vscode.SymbolKind.Function,
				'foo',
				'',
				vscode.Uri.file('/workspace/src/a.ts'),
				new vscode.Range(4, 0, 9, 0),
				new vscode.Range(4, 0, 4, 3),
			);
			assert.strictEqual(
				callItemToRangeKey('/workspace', item),
				'src/a.ts#L5-L10',
			);
		});
	});

	suite('getOutgoingAndIncomingCalls', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

		test('should detect outgoing calls', async function () {
			this.timeout(10000);
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const fm: Frontmatter = {
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 30,
				endLine: 32,
				symbol: 'myCaller',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L30-L32',
				exportedAt: '2026-01-01T00:00:00Z',
			};
			const { outgoing } = await getOutgoingAndIncomingCalls(fm, workspaceUri);
			const keys = [...outgoing];
			assert.ok(
				keys.some((k) => k.includes('myCallee')),
				`outgoing should contain myCallee, got: ${keys.join(', ')}`,
			);
		});

		test('should detect incoming calls', async function () {
			this.timeout(10000);
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const fm: Frontmatter = {
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 26,
				endLine: 28,
				symbol: 'myCallee',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L26-L28',
				exportedAt: '2026-01-01T00:00:00Z',
			};
			const { incoming } = await getOutgoingAndIncomingCalls(fm, workspaceUri);
			const keys = [...incoming];
			assert.ok(
				keys.some((k) => k.includes('myCaller')),
				`incoming should contain myCaller, got: ${keys.join(', ')}`,
			);
		});

		test('should return empty sets when symbol not found', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const fm: Frontmatter = {
				file: 'src/test/fixtures/typescript/index.ts',
				startLine: 1,
				endLine: 1,
				symbol: 'doesNotExist',
				link: 'code-trail:src/test/fixtures/typescript/index.ts#L1-L1',
				exportedAt: '2026-01-01T00:00:00Z',
			};
			const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
				fm,
				workspaceUri,
			);
			assert.strictEqual(outgoing.size, 0);
			assert.strictEqual(incoming.size, 0);
		});
	});

	const baseFm: Frontmatter = {
		file: 'src/a.ts',
		startLine: 10,
		endLine: 24,
		link: 'code-trail:src/a.ts#L10-L24',
		exportedAt: '2026-03-22T12:34:56Z',
	};

	function makeMarkInfo(markId: string, fm: Frontmatter): MarkInfo {
		return {
			markId,
			uri: vscode.Uri.file(`/tmp/${markId}`),
			fm,
			content: '',
		};
	}

	suite('markToKeys', () => {
		test('should include name key and range key when symbol exists', () => {
			const m = makeMarkInfo('a.md', { ...baseFm, symbol: 'foo' });
			const keys = markToKeys(m);
			assert.ok(keys.includes('src/a.ts#foo'));
			assert.ok(keys.includes('src/a.ts#L10-L24'));
			assert.strictEqual(keys.length, 2);
		});

		test('should use last segment for qualified symbol', () => {
			const m = makeMarkInfo('a.md', { ...baseFm, symbol: 'impl Foo.bar' });
			const keys = markToKeys(m);
			assert.ok(keys.includes('src/a.ts#bar'));
			assert.ok(keys.includes('src/a.ts#L10-L24'));
			assert.strictEqual(keys.length, 2);
		});

		test('should return only range key when no symbol', () => {
			const m = makeMarkInfo('a.md', baseFm);
			const keys = markToKeys(m);
			assert.deepStrictEqual(keys, ['src/a.ts#L10-L24']);
		});
	});

	suite('markToDescription', () => {
		test('should show symbol (file) when symbol exists', () => {
			const m = makeMarkInfo('a.md', { ...baseFm, symbol: 'handleRequest' });
			assert.strictEqual(markToDescription(m), 'handleRequest (src/a.ts)');
		});

		test('should show file#range when no symbol', () => {
			const m = makeMarkInfo('a.md', baseFm);
			assert.strictEqual(markToDescription(m), 'src/a.ts#L10-L24');
		});
	});

	suite('getLinkSuggestions', () => {
		const markA = makeMarkInfo('a.md', { ...baseFm, symbol: 'foo' });
		const markB = makeMarkInfo('b.md', {
			...baseFm,
			file: 'src/b.ts',
			symbol: 'bar',
			link: 'code-trail:src/b.ts#L10-L24',
		});
		const markC = makeMarkInfo('c.md', {
			...baseFm,
			file: 'src/c.ts',
			symbol: 'baz',
			link: 'code-trail:src/c.ts#L10-L24',
		});

		test('should mark outgoing matches as suggested uses', () => {
			const outgoing = new Set(['src/a.ts#foo']);
			const incoming = new Set<string>();
			const suggestions = getLinkSuggestions([markA], outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);
			assert.strictEqual(suggested.length, 1);
			assert.strictEqual(suggested[0].direction, 'uses');
			assert.strictEqual(suggested[0].mark.markId, 'a.md');
		});

		test('should mark incoming matches as suggested usedBy', () => {
			const outgoing = new Set<string>();
			const incoming = new Set(['src/b.ts#bar']);
			const suggestions = getLinkSuggestions([markB], outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);
			assert.strictEqual(suggested.length, 1);
			assert.strictEqual(suggested[0].direction, 'usedBy');
			assert.strictEqual(suggested[0].mark.markId, 'b.md');
		});

		test('should mark non-matching as not suggested', () => {
			const outgoing = new Set<string>();
			const incoming = new Set<string>();
			const suggestions = getLinkSuggestions([markA], outgoing, incoming);
			assert.strictEqual(suggestions.length, 1);
			assert.strictEqual(suggestions[0].suggested, false);
		});

		test('should handle both outgoing and incoming for same mark', () => {
			const outgoing = new Set(['src/a.ts#foo']);
			const incoming = new Set(['src/a.ts#foo']);
			const suggestions = getLinkSuggestions([markA], outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);
			assert.strictEqual(suggested.length, 2);
			assert.ok(suggested.some((s) => s.direction === 'uses'));
			assert.ok(suggested.some((s) => s.direction === 'usedBy'));
		});

		test('should include all marks with correct suggested flags', () => {
			const outgoing = new Set(['src/a.ts#foo']);
			const incoming = new Set<string>();
			const suggestions = getLinkSuggestions(
				[markA, markB, markC],
				outgoing,
				incoming,
			);
			assert.strictEqual(suggestions.length, 3);
			assert.strictEqual(suggestions.filter((s) => s.suggested).length, 1);
			assert.strictEqual(suggestions.filter((s) => !s.suggested).length, 2);
		});
	});

	suite('linkSuggestionsToQuickPickItems', () => {
		const markA = makeMarkInfo('a.md', { ...baseFm, symbol: 'foo' });
		const markB = makeMarkInfo('b.md', {
			...baseFm,
			file: 'src/b.ts',
			link: 'code-trail:src/b.ts#L10-L24',
		});

		test('should place suggested items before others', () => {
			const suggestions = [
				{
					mark: markB,
					direction: 'uses' as const,
					description: 'src/b.ts#L10-L24',
					suggested: false,
				},
				{
					mark: markA,
					direction: 'uses' as const,
					description: 'foo (src/example.ts)',
					suggested: true,
				},
			];
			const items = linkSuggestionsToQuickPickItems(suggestions);
			const nonSeparator = items.filter(
				(i) => i.kind !== vscode.QuickPickItemKind.Separator,
			);
			assert.ok(nonSeparator[0].detail === 'Suggested');
			assert.ok(!nonSeparator[1].detail);
		});

		test('should add separator between suggested and others', () => {
			const suggestions = [
				{
					mark: markA,
					direction: 'uses' as const,
					description: 'foo (src/example.ts)',
					suggested: true,
				},
				{
					mark: markB,
					direction: 'uses' as const,
					description: 'src/b.ts#L10-L24',
					suggested: false,
				},
			];
			const items = linkSuggestionsToQuickPickItems(suggestions);
			assert.strictEqual(items.length, 3);
			assert.ok(items[0].detail === 'Suggested');
			assert.strictEqual(items[1].kind, vscode.QuickPickItemKind.Separator);
			assert.ok(!items[2].detail);
		});

		test('should not add separator when no others', () => {
			const suggestions = [
				{
					mark: markA,
					direction: 'uses' as const,
					description: 'foo (src/example.ts)',
					suggested: true,
				},
			];
			const items = linkSuggestionsToQuickPickItems(suggestions);
			assert.strictEqual(items.length, 1);
			assert.ok(items[0].detail === 'Suggested');
		});

		test('should use arrow-right for uses and arrow-left for usedBy', () => {
			const suggestions = [
				{
					mark: markA,
					direction: 'uses' as const,
					description: 'foo',
					suggested: true,
				},
				{
					mark: markB,
					direction: 'usedBy' as const,
					description: 'bar',
					suggested: true,
				},
			];
			const items = linkSuggestionsToQuickPickItems(suggestions);
			assert.ok(items[0].label.includes('$(arrow-right)'));
			assert.ok(items[1].label.includes('$(arrow-left)'));
		});

		test('should return empty array for empty suggestions', () => {
			const items = linkSuggestionsToQuickPickItems([]);
			assert.strictEqual(items.length, 0);
		});
	});

	suite('promptAndLink', () => {
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

		test('should add bidirectional links when a mark is selected', async () => {
			const uriA = await saveMark(selectionA, fixedDate);
			const uriB = await saveMark(selectionB, new Date('2026-03-22T12:35:00Z'));
			const markIdA = uriA.fsPath.split('/').pop()!;
			const markIdB = uriB.fsPath.split('/').pop()!;

			const contentA = Buffer.from(
				await vscode.workspace.fs.readFile(uriA),
			).toString('utf-8');
			const fmA = parseFrontmatter(contentA)!;

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
				await promptAndLink(uriA, fmA);
				// Now the link where mark A uses mark B should be established.

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
			const uriA = await saveMark(selectionA, fixedDate);
			const uriB = await saveMark(selectionB, new Date('2026-03-22T12:35:00Z'));
			const markIdA = uriA.fsPath.split('/').pop()!;

			const contentA = Buffer.from(
				await vscode.workspace.fs.readFile(uriA),
			).toString('utf-8');
			const fmA = parseFrontmatter(contentA)!;

			const origShowQuickPick = vscode.window.showQuickPick;
			(vscode.window as any).showQuickPick = async () => undefined; // Do nothing

			try {
				await promptAndLink(uriA, fmA);
				// No links should be established.

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
			const uriA = await saveMark(selectionA, fixedDate);

			const contentA = Buffer.from(
				await vscode.workspace.fs.readFile(uriA),
			).toString('utf-8');
			const fmA = parseFrontmatter(contentA)!;
			const originalContent = contentA;

			await promptAndLink(uriA, fmA);

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(uriA),
			).toString('utf-8');
			assert.strictEqual(textA, originalContent);
		});
	});
});
