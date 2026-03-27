import * as assert from 'assert';
import * as vscode from 'vscode';
import { saveMark } from '../../utils/mark';
import { addLink } from '../../utils/frontmatter';
import type { SelectionInfo } from '../../utils/selection';

suite('linkMark command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	const infoA: SelectionInfo = {
		filePath: 'src/a.ts',
		fileName: 'a.ts',
		startLine: 1,
		endLine: 5,
		selectedText: 'function a() {}',
		languageId: 'typescript',
	};

	const infoB: SelectionInfo = {
		filePath: 'src/b.ts',
		fileName: 'b.ts',
		startLine: 10,
		endLine: 20,
		selectedText: 'function b() {}',
		languageId: 'typescript',
	};

	const fixedDateA = new Date('2026-03-22T12:34:56Z');
	const fixedDateB = new Date('2026-03-22T12:35:00Z');

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
		const markUri = await saveMark(infoA, fixedDateA);

		const doc = await vscode.workspace.openTextDocument(markUri);
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeTrail.linkMark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should add bidirectional links when a mark is selected', async () => {
		const markAUri = await saveMark(infoA, fixedDateA);
		const markBUri = await saveMark(infoB, fixedDateB);
		const markIdB = markBUri.fsPath.split('/').pop()!;

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
				return items.find((i: any) => i.description === markIdB);
			}
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeTrail.linkMark');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			assert.ok(
				textA.includes(`uses:\n  - code-trail:code-trail/${markIdB}`),
				'mark A should have uses link to mark B',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			const markIdA = markAUri.fsPath.split('/').pop()!;
			assert.ok(
				textB.includes(`usedBy:\n  - code-trail:code-trail/${markIdA}`),
				'mark B should have usedBy link to mark A',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should not duplicate links when linking the same marks again', async () => {
		const markAUri = await saveMark(infoA, fixedDateA);
		const markBUri = await saveMark(infoB, fixedDateB);
		const markIdA = markAUri.fsPath.split('/').pop()!;
		const markIdB = markBUri.fsPath.split('/').pop()!;

		// Pre-add links
		await addLink(markAUri, 'uses', `code-trail/${markIdB}`);
		await addLink(markBUri, 'usedBy', `code-trail/${markIdA}`);

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
				return items.find((i: any) => i.description === markIdB);
			}
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeTrail.linkMark');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			const matchesA =
				textA.match(new RegExp(`code-trail:code-trail/${markIdB}`, 'g')) ?? [];
			assert.strictEqual(
				matchesA.length,
				1,
				'mark A should not have duplicate link',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			const matchesB =
				textB.match(new RegExp(`code-trail:code-trail/${markIdA}`, 'g')) ?? [];
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
		const markAUri = await saveMark(infoA, fixedDateA);
		await saveMark(infoB, fixedDateB);

		const doc = await vscode.workspace.openTextDocument(markAUri);
		await vscode.window.showTextDocument(doc);

		const contentBefore = Buffer.from(
			await vscode.workspace.fs.readFile(markAUri),
		).toString('utf-8');

		const origShowQuickPick = vscode.window.showQuickPick;
		(vscode.window as any).showQuickPick = async () => undefined;

		try {
			await vscode.commands.executeCommand('codeTrail.linkMark');

			const contentAfter = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			assert.strictEqual(
				contentAfter,
				contentBefore,
				'mark A should be unchanged',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});
});
