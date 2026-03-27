import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	markToKey,
	markToDescription,
	getLinkSuggestions,
	getOutgoingAndIncomingCalls,
	callItemToSymbolKey,
	callItemToRangeKey,
	linkSuggestionsToQuickPickItems,
	promptAndLink,
} from '../../utils/link';
import { saveMark } from '../../utils/mark';
import { parseFrontmatter } from '../../utils/frontmatter';
import type { MarkInfo } from '../../utils/mark';
import type { Frontmatter } from '../../utils/frontmatter';
import type { SelectionInfo } from '../../utils/selection';

suite('link', () => {
	suite('callItemToSymbolKey', () => {
		test('should return file#name for item without detail', () => {
			const item = new vscode.CallHierarchyItem(
				vscode.SymbolKind.Function,
				'foo',
				'',
				vscode.Uri.file('/workspace/src/a.ts'),
				new vscode.Range(0, 0, 2, 0),
				new vscode.Range(0, 0, 0, 3),
			);
			assert.strictEqual(
				callItemToSymbolKey('/workspace', item),
				'src/a.ts#foo',
			);
		});

		test('should return file#detail.name for item with detail', () => {
			const item = new vscode.CallHierarchyItem(
				vscode.SymbolKind.Method,
				'bar',
				'Foo',
				vscode.Uri.file('/workspace/src/a.ts'),
				new vscode.Range(1, 0, 3, 0),
				new vscode.Range(1, 0, 1, 3),
			);
			assert.strictEqual(
				callItemToSymbolKey('/workspace', item),
				'src/a.ts#Foo.bar',
			);
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

		async function createTsFile(
			name: string,
			content: string,
		): Promise<vscode.Uri> {
			const uri = vscode.Uri.joinPath(workspaceUri, name);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
			const doc = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(doc);
			await waitForSymbols(uri);
			return uri;
		}

		async function waitForSymbols(
			uri: vscode.Uri,
			timeout = 2000,
		): Promise<void> {
			const start = Date.now();
			while (Date.now() - start < timeout) {
				const symbols = await vscode.commands.executeCommand<
					vscode.DocumentSymbol[]
				>('vscode.executeDocumentSymbolProvider', uri);
				if (symbols?.length) {
					return;
				}
				await new Promise((r) => setTimeout(r, 100));
			}
		}

		async function deleteSilently(uri: vscode.Uri) {
			try {
				await vscode.workspace.fs.delete(uri);
			} catch {}
		}

		test('should detect outgoing calls', async function () {
			this.timeout(10000);
			const calleeUri = await createTsFile(
				'tmp-callee.ts',
				'export function callee() { return 1; }\n',
			);
			const callerUri = await createTsFile(
				'tmp-caller.ts',
				'import { callee } from "./tmp-callee";\nexport function caller() { callee(); }\n',
			);
			try {
				const fm: Frontmatter = {
					file: 'tmp-caller.ts',
					startLine: 2,
					endLine: 2,
					symbol: 'caller',
					link: 'code-trail:tmp-caller.ts#L2-L2',
					exportedAt: '2026-01-01T00:00:00Z',
				};
				const { outgoing } = await getOutgoingAndIncomingCalls(
					fm,
					workspaceUri,
				);
				const keys = [...outgoing];
				assert.ok(
					keys.some((k) => k.includes('callee')),
					`outgoing should contain callee, got: ${keys.join(', ')}`,
				);
			} finally {
				await deleteSilently(callerUri);
				await deleteSilently(calleeUri);
			}
		});

		test('should detect incoming calls', async function () {
			this.timeout(10000);
			const calleeUri = await createTsFile(
				'tmp-callee2.ts',
				'export function callee2() { return 1; }\n',
			);
			const callerUri = await createTsFile(
				'tmp-caller2.ts',
				'import { callee2 } from "./tmp-callee2";\nexport function caller2() { callee2(); }\n',
			);
			try {
				const fm: Frontmatter = {
					file: 'tmp-callee2.ts',
					startLine: 1,
					endLine: 1,
					symbol: 'callee2',
					link: 'code-trail:tmp-callee2.ts#L1-L1',
					exportedAt: '2026-01-01T00:00:00Z',
				};
				const { incoming } = await getOutgoingAndIncomingCalls(
					fm,
					workspaceUri,
				);
				const keys = [...incoming];
				assert.ok(
					keys.some((k) => k.includes('caller2')),
					`incoming should contain caller2, got: ${keys.join(', ')}`,
				);
			} finally {
				await deleteSilently(callerUri);
				await deleteSilently(calleeUri);
			}
		});

		test('should return empty sets when no callers and no callees', async () => {
			const uri = await createTsFile(
				'tmp-nosym.ts',
				'export function exists() {}\n',
			);
			try {
				const fm: Frontmatter = {
					file: 'tmp-nosym.ts',
					startLine: 1,
					endLine: 1,
					symbol: 'doesNotExist',
					link: 'code-trail:tmp-nosym.ts#L1-L1',
					exportedAt: '2026-01-01T00:00:00Z',
				};
				const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
					fm,
					workspaceUri,
				);
				assert.strictEqual(outgoing.size, 0);
				assert.strictEqual(incoming.size, 0);
			} finally {
				await deleteSilently(uri);
			}
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
		};
	}

	suite('markToKey', () => {
		test('should use file#symbol when symbol exists', () => {
			const m = makeMarkInfo('a.md', { ...baseFm, symbol: 'foo' });
			assert.strictEqual(markToKey(m), 'src/a.ts#foo');
		});

		test('should use file#range when no symbol', () => {
			const m = makeMarkInfo('a.md', baseFm);
			assert.strictEqual(markToKey(m), 'src/a.ts#L10-L24');
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

		test('should add bidirectional links when a mark is selected', async () => {
			const uriA = await saveMark(infoA, fixedDate);
			const uriB = await saveMark(infoB, new Date('2026-03-22T12:35:00Z'));
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
			const uriA = await saveMark(infoA, fixedDate);
			const uriB = await saveMark(infoB, new Date('2026-03-22T12:35:00Z'));
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
			const uriA = await saveMark(infoA, fixedDate);

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
