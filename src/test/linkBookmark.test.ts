import * as assert from 'assert';
import * as vscode from 'vscode';
import { getSymbolRange } from '../utils/editor';

suite('linkBookmark command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-atlas');

	function makeBookmarkContent(
		file: string,
		startLine: number,
		endLine: number,
		opts?: { symbol?: string; uses?: string[]; usedBy?: string[] },
	): string {
		const lines = [
			'---',
			`file: ${file}`,
			`range: L${startLine}-L${endLine}`,
			`link: code-atlas:${file}#L${startLine}-L${endLine}`,
			`exportedAt: 2025-01-01T00:00:00Z`,
		];
		if (opts?.symbol) {
			lines.push(`symbol: ${opts.symbol}`);
		}
		if (opts?.uses) {
			lines.push('uses:');
			for (const u of opts.uses) {
				lines.push(`  - ${u}`);
			}
		}
		if (opts?.usedBy) {
			lines.push('usedBy:');
			for (const u of opts.usedBy) {
				lines.push(`  - ${u}`);
			}
		}
		lines.push('---', '', '# Notes', '');
		return lines.join('\n');
	}

	async function cleanup() {
		try {
			await vscode.workspace.fs.delete(outputDir, { recursive: true });
		} catch {
			// ignore if not exists
		}
	}

	setup(cleanup);
	teardown(cleanup);

	test('should show warning when current file is not a valid bookmark', async () => {
		const doc = await vscode.workspace.openTextDocument({
			content: 'not a bookmark',
			language: 'markdown',
		});
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeAtlas.linkBookmark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should show warning when no other bookmarks exist', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);
		const bookmarkUri = vscode.Uri.joinPath(outputDir, 'only-one.md');
		const content = makeBookmarkContent('src/a.ts', 1, 5);
		await vscode.workspace.fs.writeFile(
			bookmarkUri,
			Buffer.from(content, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(bookmarkUri);
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeAtlas.linkBookmark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should add bidirectional links when a bookmark is selected', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const bookmarkAUri = vscode.Uri.joinPath(outputDir, 'bookmark-a.md');
		const bookmarkBUri = vscode.Uri.joinPath(outputDir, 'bookmark-b.md');
		const contentA = makeBookmarkContent('src/a.ts', 1, 5);
		const contentB = makeBookmarkContent('src/b.ts', 10, 20);
		await vscode.workspace.fs.writeFile(
			bookmarkAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			bookmarkBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		// Open bookmark A as the active editor
		const doc = await vscode.workspace.openTextDocument(bookmarkAUri);
		await vscode.window.showTextDocument(doc);

		// Stub showQuickPick to auto-select bookmark B with 'uses' direction
		const origShowQuickPick = vscode.window.showQuickPick;
		let callCount = 0;
		(vscode.window as any).showQuickPick = async (
			items: any[],
			_options?: any,
		) => {
			callCount++;
			if (callCount === 1) {
				// First call: select the bookmark candidate
				return items.find(
					(i: any) => i.description === 'bookmark-b.md',
				);
			}
			// Second call: direction pick (for non-suggested items)
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeAtlas.linkBookmark');

			// Verify bookmark A now has uses: bookmark-b.md
			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(bookmarkAUri),
			).toString('utf-8');
			assert.ok(
				textA.includes('uses:'),
				'bookmark A should have uses field',
			);
			assert.ok(
				textA.includes('  - bookmark-b.md'),
				'bookmark A should link to bookmark-b.md',
			);

			// Verify bookmark B now has usedBy: bookmark-a.md
			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(bookmarkBUri),
			).toString('utf-8');
			assert.ok(
				textB.includes('usedBy:'),
				'bookmark B should have usedBy field',
			);
			assert.ok(
				textB.includes('  - bookmark-a.md'),
				'bookmark B should link to bookmark-a.md',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should not duplicate links when linking the same bookmarks again', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const bookmarkAUri = vscode.Uri.joinPath(outputDir, 'bookmark-a.md');
		const bookmarkBUri = vscode.Uri.joinPath(outputDir, 'bookmark-b.md');
		// A already has a uses link to B
		const contentA = makeBookmarkContent('src/a.ts', 1, 5, {
			uses: ['bookmark-b.md'],
		});
		// B already has a usedBy link to A
		const contentB = makeBookmarkContent('src/b.ts', 10, 20, {
			usedBy: ['bookmark-a.md'],
		});
		await vscode.workspace.fs.writeFile(
			bookmarkAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			bookmarkBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(bookmarkAUri);
		await vscode.window.showTextDocument(doc);

		const origShowQuickPick = vscode.window.showQuickPick;
		let callCount = 0;
		(vscode.window as any).showQuickPick = async (
			items: any[],
			_options?: any,
		) => {
			callCount++;
			if (callCount === 1) {
				return items.find(
					(i: any) => i.description === 'bookmark-b.md',
				);
			}
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeAtlas.linkBookmark');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(bookmarkAUri),
			).toString('utf-8');
			// Count occurrences of bookmark-b.md — should be exactly 1
			const matchesA = textA.match(/bookmark-b\.md/g) ?? [];
			assert.strictEqual(
				matchesA.length,
				1,
				'bookmark A should not have duplicate link',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(bookmarkBUri),
			).toString('utf-8');
			const matchesB = textB.match(/bookmark-a\.md/g) ?? [];
			assert.strictEqual(
				matchesB.length,
				1,
				'bookmark B should not have duplicate link',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should do nothing when quick pick is cancelled', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const bookmarkAUri = vscode.Uri.joinPath(outputDir, 'bookmark-a.md');
		const bookmarkBUri = vscode.Uri.joinPath(outputDir, 'bookmark-b.md');
		const contentA = makeBookmarkContent('src/a.ts', 1, 5);
		const contentB = makeBookmarkContent('src/b.ts', 10, 20);
		await vscode.workspace.fs.writeFile(
			bookmarkAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			bookmarkBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(bookmarkAUri);
		await vscode.window.showTextDocument(doc);

		const origShowQuickPick = vscode.window.showQuickPick;
		(vscode.window as any).showQuickPick = async () => undefined;

		try {
			await vscode.commands.executeCommand('codeAtlas.linkBookmark');

			// Neither file should be modified
			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(bookmarkAUri),
			).toString('utf-8');
			assert.strictEqual(textA, contentA, 'bookmark A should be unchanged');

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(bookmarkBUri),
			).toString('utf-8');
			assert.strictEqual(textB, contentB, 'bookmark B should be unchanged');
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});
});

suite('getSymbolRange', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	async function createTsFile(
		name: string,
		content: string,
	): Promise<vscode.Uri> {
		const uri = vscode.Uri.joinPath(workspaceUri, name);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc);
		return uri;
	}

	async function deleteSilently(uri: vscode.Uri) {
		try {
			await vscode.workspace.fs.delete(uri);
		} catch {
			// ignore
		}
	}

	test('should return selectionRange for a top-level function', async () => {
		const uri = await createTsFile(
			'tmp-sym-toplevel.ts',
			'function greet() {\n  return "hi";\n}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'greet');
			assert.ok(range, 'should find symbol greet');
			assert.strictEqual(range.start.line, 0);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return selectionRange for a nested function using qualified name', async () => {
		const uri = await createTsFile(
			'tmp-sym-nested.ts',
			'function outer() {\n  function inner() {\n    return 1;\n  }\n}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'outer.inner');
			assert.ok(range, 'should find symbol outer.inner');
			assert.strictEqual(range.start.line, 1);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return selectionRange for a class method', async () => {
		const uri = await createTsFile(
			'tmp-sym-method.ts',
			'class Foo {\n  bar() {\n    return 42;\n  }\n}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'Foo.bar');
			assert.ok(range, 'should find symbol Foo.bar');
			assert.strictEqual(range.start.line, 1);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return undefined for a non-existent symbol', async () => {
		const uri = await createTsFile(
			'tmp-sym-missing.ts',
			'function exists() {}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'doesNotExist');
			assert.strictEqual(range, undefined);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return undefined for a file with no symbol provider', async () => {
		const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-sym-plain.txt');
		await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
		try {
			const range = await getSymbolRange(uri, 'anything');
			assert.strictEqual(range, undefined);
		} finally {
			await deleteSilently(uri);
		}
	});
});
