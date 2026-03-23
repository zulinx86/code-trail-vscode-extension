import * as assert from 'assert';
import * as vscode from 'vscode';

suite('linkPin command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-atlas');

	function makePinContent(
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

	test('should show warning when current file is not a valid pin', async () => {
		const doc = await vscode.workspace.openTextDocument({
			content: 'not a pin',
			language: 'markdown',
		});
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeAtlas.linkPin');

		// No crash; command exits gracefully (warning shown)
	});

	test('should show warning when no other pins exist', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);
		const pinUri = vscode.Uri.joinPath(outputDir, 'only-one.md');
		const content = makePinContent('src/a.ts', 1, 5);
		await vscode.workspace.fs.writeFile(
			pinUri,
			Buffer.from(content, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(pinUri);
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeAtlas.linkPin');

		// No crash; command exits gracefully (warning shown)
	});

	test('should add bidirectional links when a pin is selected', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const pinAUri = vscode.Uri.joinPath(outputDir, 'pin-a.md');
		const pinBUri = vscode.Uri.joinPath(outputDir, 'pin-b.md');
		const contentA = makePinContent('src/a.ts', 1, 5);
		const contentB = makePinContent('src/b.ts', 10, 20);
		await vscode.workspace.fs.writeFile(
			pinAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			pinBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		// Open pin A as the active editor
		const doc = await vscode.workspace.openTextDocument(pinAUri);
		await vscode.window.showTextDocument(doc);

		// Stub showQuickPick to auto-select pin B with 'uses' direction
		const origShowQuickPick = vscode.window.showQuickPick;
		let callCount = 0;
		(vscode.window as any).showQuickPick = async (
			items: any[],
			_options?: any,
		) => {
			callCount++;
			if (callCount === 1) {
				// First call: select the pin candidate
				return items.find(
					(i: any) => i.description === 'pin-b.md',
				);
			}
			// Second call: direction pick (for non-suggested items)
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeAtlas.linkPin');

			// Verify pin A now has uses: pin-b.md
			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(pinAUri),
			).toString('utf-8');
			assert.ok(
				textA.includes('uses:'),
				'pin A should have uses field',
			);
			assert.ok(
				textA.includes('  - pin-b.md'),
				'pin A should link to pin-b.md',
			);

			// Verify pin B now has usedBy: pin-a.md
			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(pinBUri),
			).toString('utf-8');
			assert.ok(
				textB.includes('usedBy:'),
				'pin B should have usedBy field',
			);
			assert.ok(
				textB.includes('  - pin-a.md'),
				'pin B should link to pin-a.md',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should not duplicate links when linking the same pins again', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const pinAUri = vscode.Uri.joinPath(outputDir, 'pin-a.md');
		const pinBUri = vscode.Uri.joinPath(outputDir, 'pin-b.md');
		// A already has a uses link to B
		const contentA = makePinContent('src/a.ts', 1, 5, {
			uses: ['pin-b.md'],
		});
		// B already has a usedBy link to A
		const contentB = makePinContent('src/b.ts', 10, 20, {
			usedBy: ['pin-a.md'],
		});
		await vscode.workspace.fs.writeFile(
			pinAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			pinBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(pinAUri);
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
					(i: any) => i.description === 'pin-b.md',
				);
			}
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeAtlas.linkPin');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(pinAUri),
			).toString('utf-8');
			const matchesA = textA.match(/pin-b\.md/g) ?? [];
			assert.strictEqual(
				matchesA.length,
				1,
				'pin A should not have duplicate link',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(pinBUri),
			).toString('utf-8');
			const matchesB = textB.match(/pin-a\.md/g) ?? [];
			assert.strictEqual(
				matchesB.length,
				1,
				'pin B should not have duplicate link',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should do nothing when quick pick is cancelled', async () => {
		await vscode.workspace.fs.createDirectory(outputDir);

		const pinAUri = vscode.Uri.joinPath(outputDir, 'pin-a.md');
		const pinBUri = vscode.Uri.joinPath(outputDir, 'pin-b.md');
		const contentA = makePinContent('src/a.ts', 1, 5);
		const contentB = makePinContent('src/b.ts', 10, 20);
		await vscode.workspace.fs.writeFile(
			pinAUri,
			Buffer.from(contentA, 'utf-8'),
		);
		await vscode.workspace.fs.writeFile(
			pinBUri,
			Buffer.from(contentB, 'utf-8'),
		);

		const doc = await vscode.workspace.openTextDocument(pinAUri);
		await vscode.window.showTextDocument(doc);

		const origShowQuickPick = vscode.window.showQuickPick;
		(vscode.window as any).showQuickPick = async () => undefined;

		try {
			await vscode.commands.executeCommand('codeAtlas.linkPin');

			// Neither file should be modified
			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(pinAUri),
			).toString('utf-8');
			assert.strictEqual(textA, contentA, 'pin A should be unchanged');

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(pinBUri),
			).toString('utf-8');
			assert.strictEqual(textB, contentB, 'pin B should be unchanged');
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});
});
