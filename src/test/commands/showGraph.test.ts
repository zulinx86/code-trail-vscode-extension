import * as assert from 'assert';
import * as vscode from 'vscode';
import { workspaceFolder } from '../../config';
import { Mark, MarkArgs } from '../../utils/mark';
import {
	showGraph,
	handleWebviewMessage,
	refreshGraph,
} from '../../commands/showGraph';

suite('showGraph command', () => {
	const workspaceUri = workspaceFolder!.uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	async function cleanup() {
		try {
			await vscode.workspace.fs.delete(outputDir, { recursive: true });
		} catch {}
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	}

	setup(cleanup);
	teardown(cleanup);

	const markArgs: MarkArgs = {
		file: 'src/example.ts',
		startLine: 1,
		endLine: 5,
		link: 'code-atlas:src/example.ts#L1-L5',
		exportedAt: new Date('2026-03-22T12:34:56Z'),
		symbol: 'foo',
		symbolKind: 'function',
		code: 'function foo() {}',
	};

	test('should open graph panel without errors when no marks exist', async () => {
		await vscode.commands.executeCommand('codeTrail.showGraph');

		// Verify a webview panel was created
		const panel = vscode.window.tabGroups.all
			.flatMap((g) => g.tabs)
			.find((t) => t.label === 'Code Trail: Graph');
		assert.ok(panel, 'graph panel should be open');
	});

	test('should open graph panel without errors when marks exist', async () => {
		await new Mark(markArgs).save();

		await vscode.commands.executeCommand('codeTrail.showGraph');

		const panel = vscode.window.tabGroups.all
			.flatMap((g) => g.tabs)
			.find((t) => t.label === 'Code Trail: Graph');
		assert.ok(panel, 'graph panel should be open');
	});

	test('should open mark file when openMark message is received', async () => {
		const markUri = await new Mark(markArgs).save();
		const markId = markUri.fsPath.split('/').pop()!;

		await handleWebviewMessage({ type: 'openMark', markId });

		const openedDoc = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.fsPath === markUri.fsPath,
		);
		assert.ok(openedDoc, 'mark file should be opened in editor');
	});

	test('should refresh graph without errors', async () => {
		const context = {
			extensionUri: workspaceUri,
			extensionPath: workspaceUri.fsPath,
		} as any;
		const panel = await showGraph(context);

		try {
			// Add a mark after graph is open
			await new Mark(markArgs).save();

			// Manually call refreshGraph and verify no errors
			await refreshGraph(panel);
			assert.ok(panel.visible, 'panel should still be visible after refresh');
		} finally {
			panel.dispose();
		}
	});
});
