import * as assert from 'assert';
import * as vscode from 'vscode';

suite('linkMark command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	function makeMarkContent(
		file: string,
		startLine: number,
		endLine: number,
		opts?: { symbol?: string; uses?: string[]; usedBy?: string[] },
	): string {
		const lines = [
			'---',
			`file: ${file}`,
			`range: L${startLine}-L${endLine}`,
			`link: code-trail:${file}#L${startLine}-L${endLine}`,
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

	test('should show warning when current file is not a valid mark', async () => {
		const doc = await vscode.workspace.openTextDocument({
			content: 'not a mark',
			language: 'markdown',
		});
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeTrail.linkMark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should show warning when no other marks exist', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);
		const markUri = vscode.Uri.joinPath(outputDir, 'only-one.md');
		const content = makeMarkContent('src/a.ts', 1, 5);
		await vscode.workspace.fs.writeFile(markUri, Buffer.from(content, 'utf-8'));

		const doc = await vscode.workspace.openTextDocument(markUri);
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeTrail.linkMark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should add bidirectional links when a mark is selected', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const markAUri = vscode.Uri.joinPath(outputDir, 'mark-a.md');
		const markBUri = vscode.Uri.joinPath(outputDir, 'mark-b.md');
		const contentA = makeMarkContent('src/a.ts', 1, 5);
		const contentB = makeMarkContent('src/b.ts', 10, 20);
		await vscode.workspace.fs.writeFile(
			markAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			markBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		// Open mark A as the active editor
		const doc = await vscode.workspace.openTextDocument(markAUri);
		await vscode.window.showTextDocument(doc);

		// Stub showQuickPick to auto-select mark B with 'uses' direction
		const origShowQuickPick = vscode.window.showQuickPick;
		let callCount = 0;
		(vscode.window as any).showQuickPick = async (
			items: any[],
			_options?: any,
		) => {
			callCount++;
			if (callCount === 1) {
				// First call: select the mark candidate
				return items.find((i: any) => i.description === 'mark-b.md');
			}
			// Second call: direction pick (for non-suggested items)
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeTrail.linkMark');

			// Verify mark A now has uses: mark-b.md
			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			assert.ok(textA.includes('uses:'), 'mark A should have uses field');
			assert.ok(
				textA.includes('  - code-trail:code-trail/mark-b.md'),
				'mark A should link to mark-b.md',
			);

			// Verify mark B now has usedBy: mark-a.md
			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			assert.ok(textB.includes('usedBy:'), 'mark B should have usedBy field');
			assert.ok(
				textB.includes('  - code-trail:code-trail/mark-a.md'),
				'mark B should link to mark-a.md',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should not duplicate links when linking the same marks again', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const markAUri = vscode.Uri.joinPath(outputDir, 'mark-a.md');
		const markBUri = vscode.Uri.joinPath(outputDir, 'mark-b.md');
		// A already has a uses link to B
		const contentA = makeMarkContent('src/a.ts', 1, 5, {
			uses: ['code-trail:code-trail/mark-b.md'],
		});
		// B already has a usedBy link to A
		const contentB = makeMarkContent('src/b.ts', 10, 20, {
			usedBy: ['code-trail:code-trail/mark-a.md'],
		});
		await vscode.workspace.fs.writeFile(
			markAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			markBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(markAUri);
		await vscode.window.showTextDocument(doc);

		const origShowQuickPick = vscode.window.showQuickPick;
		let callCount = 0;
		(vscode.window as any).showQuickPick = async (
			items: any[],
			_options?: any,
		) => {
			callCount++;
			if (callCount === 1) {
				return items.find((i: any) => i.description === 'mark-b.md');
			}
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeTrail.linkMark');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			const matchesA = textA.match(/code-trail:code-trail\/mark-b\.md/g) ?? [];
			assert.strictEqual(
				matchesA.length,
				1,
				'mark A should not have duplicate link',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			const matchesB = textB.match(/code-trail:code-trail\/mark-a\.md/g) ?? [];
			assert.strictEqual(
				matchesB.length,
				1,
				'mark B should not have duplicate link',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should do nothing when quick pick is cancelled', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const markAUri = vscode.Uri.joinPath(outputDir, 'mark-a.md');
		const markBUri = vscode.Uri.joinPath(outputDir, 'mark-b.md');
		const contentA = makeMarkContent('src/a.ts', 1, 5);
		const contentB = makeMarkContent('src/b.ts', 10, 20);
		await vscode.workspace.fs.writeFile(
			markAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			markBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(markAUri);
		await vscode.window.showTextDocument(doc);

		const origShowQuickPick = vscode.window.showQuickPick;
		(vscode.window as any).showQuickPick = async () => undefined;

		try {
			await vscode.commands.executeCommand('codeTrail.linkMark');

			// Neither file should be modified
			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			assert.strictEqual(textA, contentA, 'mark A should be unchanged');

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			assert.strictEqual(textB, contentB, 'mark B should be unchanged');
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});
});
