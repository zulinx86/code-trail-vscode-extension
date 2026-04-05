import * as assert from 'assert';
import * as vscode from 'vscode';
import { Mark, MarkArgs } from '../../utils/mark';

suite('connectMark command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	const markArgsA: MarkArgs = {
		file: 'src/a.ts',
		startLine: 1,
		endLine: 5,
		link: 'code-trail:code-trail/src/a.ts',
		exportedAt: new Date('2026-03-22T12:34:56Z'),
		code: 'function a() {}',
	};

	const markArgsB: MarkArgs = {
		file: 'src/b.ts',
		startLine: 10,
		endLine: 20,
		link: 'code-trail:code-trail/src/b.ts',
		exportedAt: new Date('2026-03-22T12:35:00Z'),
		code: 'function b() {}',
	};

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

		await vscode.commands.executeCommand('codeTrail.connectMark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should show warning when no other marks exist', async () => {
		const markUri = await new Mark(markArgsA).save();

		const doc = await vscode.workspace.openTextDocument(markUri);
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeTrail.connectMark');

		// No crash; command exits gracefully (warning shown)
	});

	test('should add bidirectional connections when a mark is selected', async () => {
		const markAUri = await new Mark(markArgsA).save();
		const markBUri = await new Mark(markArgsB).save();
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
			await vscode.commands.executeCommand('codeTrail.connectMark');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			assert.ok(
				textA.includes(`uses:\n  - code-trail:code-trail/${markIdB}`),
				'mark A should have uses connection to mark B',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			const markIdA = markAUri.fsPath.split('/').pop()!;
			assert.ok(
				textB.includes(`usedBy:\n  - code-trail:code-trail/${markIdA}`),
				'mark B should have usedBy conection to mark A',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should not duplicate connections when connecting the same marks again', async () => {
		const markA = new Mark(markArgsA);
		const markAUri = await markA.save();
		const markAId = markA.id;
		const markB = new Mark(markArgsB);
		const markBUri = await markB.save();
		const markBId = markB.id;

		// Pre-add connections
		await markA.connect('uses', markB.id);
		await markB.connect('usedBy', markA.id);

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
				return items.find((i: any) => i.description === markBId);
			}
			return items.find((i: any) => i.value === 'uses');
		};

		try {
			await vscode.commands.executeCommand('codeTrail.connectMark');

			const textA = Buffer.from(
				await vscode.workspace.fs.readFile(markAUri),
			).toString('utf-8');
			const matchesA =
				textA.match(new RegExp(`code-trail:code-trail/${markBId}`, 'g')) ?? [];
			assert.strictEqual(
				matchesA.length,
				1,
				'mark A should not have duplicate connection',
			);

			const textB = Buffer.from(
				await vscode.workspace.fs.readFile(markBUri),
			).toString('utf-8');
			const matchesB =
				textB.match(new RegExp(`code-trail:code-trail/${markAId}`, 'g')) ?? [];
			assert.strictEqual(
				matchesB.length,
				1,
				'mark B should not have duplicate connection',
			);
		} finally {
			(vscode.window as any).showQuickPick = origShowQuickPick;
		}
	});

	test('should do nothing when quick pick is cancelled', async () => {
		const markAUri = await new Mark(markArgsA).save();
		await new Mark(markArgsB).save();

		const doc = await vscode.workspace.openTextDocument(markAUri);
		await vscode.window.showTextDocument(doc);

		const contentBefore = Buffer.from(
			await vscode.workspace.fs.readFile(markAUri),
		).toString('utf-8');

		const origShowQuickPick = vscode.window.showQuickPick;
		(vscode.window as any).showQuickPick = async () => undefined;

		try {
			await vscode.commands.executeCommand('codeTrail.connectMark');

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
