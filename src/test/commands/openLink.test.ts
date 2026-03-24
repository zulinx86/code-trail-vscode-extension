import * as assert from 'assert';
import * as vscode from 'vscode';

suite('openLink command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	test('should open file and move cursor to startLine', async () => {
		const tmpFileUri = vscode.Uri.joinPath(
			workspaceUri,
			'tmp-test-openlink.ts',
		);
		const content = 'line1\nline2\nline3\nline4\nline5\n';
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from(content, 'utf-8'),
		);

		try {
			// open a markdown file to trigger extension activation
			const mdDoc = await vscode.workspace.openTextDocument({
				content: '',
				language: 'markdown',
			});
			await vscode.window.showTextDocument(mdDoc);

			await vscode.commands.executeCommand('codeTrail.openLink', {
				filePath: 'tmp-test-openlink.ts',
				startLine: 3,
				endLine: 4,
			});

			const editor = vscode.window.activeTextEditor;
			assert.ok(editor);
			assert.ok(editor.document.uri.fsPath.endsWith('tmp-test-openlink.ts'));
			assert.strictEqual(editor.selection.active.line, 2); // 0-indexed
			assert.strictEqual(editor.selection.active.character, 0);
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});
});
