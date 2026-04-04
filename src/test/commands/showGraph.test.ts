import * as assert from 'assert';
import * as vscode from 'vscode';
import { saveMark } from '../../utils/mark';
import {
	showGraph,
	handleWebviewMessage,
	refreshGraph,
} from '../../commands/showGraph';
import { Selection } from '../../utils/selection';

suite('showGraph command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	async function cleanup() {
		try {
			await vscode.workspace.fs.delete(outputDir, { recursive: true });
		} catch {}
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	}

	setup(cleanup);
	teardown(cleanup);

	test('should open graph panel without errors when no marks exist', async () => {
		await vscode.commands.executeCommand('codeTrail.showGraph');

		// Verify a webview panel was created
		const panel = vscode.window.tabGroups.all
			.flatMap((g) => g.tabs)
			.find((t) => t.label === 'Code Trail: Graph');
		assert.ok(panel, 'graph panel should be open');
	});

	test('should open graph panel without errors when marks exist', async () => {
		const selection = new Selection({
			filePath: 'src/example.ts',
			startLine: 1,
			endLine: 5,
			selectedText: 'function foo() {}',
			symbol: 'foo',
			symbolKind: 'function',
		});
		await saveMark(selection, new Date('2026-03-22T12:34:56Z'));

		await vscode.commands.executeCommand('codeTrail.showGraph');

		const panel = vscode.window.tabGroups.all
			.flatMap((g) => g.tabs)
			.find((t) => t.label === 'Code Trail: Graph');
		assert.ok(panel, 'graph panel should be open');
	});

	test('should open mark file when openMark message is received', async () => {
		const selection = new Selection({
			filePath: 'src/example.ts',
			startLine: 1,
			endLine: 5,
			selectedText: 'function foo() {}',
			symbol: 'foo',
			symbolKind: 'function',
		});
		const markUri = await saveMark(selection, new Date('2026-03-22T12:34:56Z'));
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
			const selection = new Selection({
				filePath: ' src/example.ts',
				startLine: 1,
				endLine: 5,
				selectedText: 'function foo() {}',
				symbol: 'foo',
				symbolKind: 'function',
			});
			await saveMark(selection, new Date('2026-03-22T12:34:56Z'));

			// Manually call refreshGraph and verify no errors
			await refreshGraph(panel);
			assert.ok(panel.visible, 'panel should still be visible after refresh');
		} finally {
			panel.dispose();
		}
	});
});
