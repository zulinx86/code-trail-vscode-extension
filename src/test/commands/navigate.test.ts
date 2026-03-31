import * as assert from 'assert';
import * as vscode from 'vscode';

suite('navigate command', () => {
	test('should open file and move cursor to startLine', async () => {
		const mdDoc = await vscode.workspace.openTextDocument({
			content: '',
			language: 'markdown',
		});
		await vscode.window.showTextDocument(mdDoc);

		await vscode.commands.executeCommand('codeTrail.navigate', {
			filePath: 'src/test/fixtures/typescript/plain-text.ts',
			startLine: 3,
			endLine: 4,
		});

		const editor = vscode.window.activeTextEditor;
		assert.ok(editor);
		assert.ok(editor.document.uri.fsPath.endsWith('plain-text.ts'));
		assert.strictEqual(editor.selection.active.line, 2); // 0-indexed
		assert.strictEqual(editor.selection.active.character, 0);
	});
});
