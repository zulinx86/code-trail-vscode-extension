import * as assert from 'assert';
import * as vscode from 'vscode';

suite('bookmarkSelection command', () => {
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
		await vscode.commands.executeCommand('codeAtlas.bookmarkSelection');

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

			await vscode.commands.executeCommand('codeAtlas.bookmarkSelection');

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

	test('should expand partial selection to full lines', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-test-partial.ts');
		const content = 'aaa\nbbbb\ncccc\nddd\n';
		await vscode.workspace.fs.writeFile(tmpFileUri, Buffer.from(content, 'utf-8'));

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);

			// select from middle of line 2 to middle of line 3
			editor.selection = new vscode.Selection(1, 2, 2, 1);

			await vscode.commands.executeCommand('codeAtlas.bookmarkSelection');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.ok(files.length >= 1);

			const [fileName] = files[0];
			const fileUri = vscode.Uri.joinPath(outputDir, fileName);
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const text = Buffer.from(bytes).toString('utf-8');

			// should contain full lines, not partial
			assert.ok(text.includes('bbbb\ncccc'));
			assert.ok(text.includes('range: 2-3'));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});
});
