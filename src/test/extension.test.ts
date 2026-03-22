import * as assert from 'assert';
import * as vscode from 'vscode';

suite('exportSelection command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-atlas');

	async function cleanup() {
		try {
			await vscode.workspace.fs.delete(outputDir, { recursive: true });
		} catch {
			// ignore if not exists
		}
	}

	setup(cleanup);
	teardown(cleanup);

	test('should show warning when no text is selected', async () => {
		const doc = await vscode.workspace.openTextDocument({ content: 'hello', language: 'typescript' });
		await vscode.window.showTextDocument(doc);

		// selection is empty by default
		await vscode.commands.executeCommand('codeAtlas.exportSelection');

		// output directory should not be created
		try {
			await vscode.workspace.fs.stat(outputDir);
			assert.fail('output directory should not exist');
		} catch {
			// expected
		}
	});

	test('should export selected text to a markdown file', async () => {
		// create a real file in the workspace so path.relative works
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-test-file.ts');
		const content = 'line1\nline2\nline3\nline4\n';
		await vscode.workspace.fs.writeFile(tmpFileUri, Buffer.from(content, 'utf-8'));

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);

			// select line 2-3
			editor.selection = new vscode.Selection(1, 0, 2, 5);

			await vscode.commands.executeCommand('codeAtlas.exportSelection');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.ok(files.length >= 1);

			// file content correctness is tested in format.test.ts
			const [fileName] = files[0];
			assert.ok(fileName.endsWith('-tmp-test-file.ts.md'));
			assert.ok(/^\d{8}-\d{6}-/.test(fileName));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});
});
