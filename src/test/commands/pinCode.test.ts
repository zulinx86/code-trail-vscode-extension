import * as assert from 'assert';
import * as vscode from 'vscode';

suite('pinCode command', () => {
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

	test('should show warning when no selection and no function at cursor', async () => {
		const doc = await vscode.workspace.openTextDocument({
			content: 'hello',
			language: 'plaintext',
		});
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('codeAtlas.pinCode');

		try {
			await vscode.workspace.fs.stat(outputDir);
			assert.fail('output directory should not exist');
		} catch {
			// expected
		}
	});

	test('should create a pin file from selection', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-pin-sel.ts');
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from('line1\nline2\nline3\n', 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);
			editor.selection = new vscode.Selection(1, 0, 2, 5);

			await vscode.commands.executeCommand('codeAtlas.pinCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.strictEqual(files.length, 1);
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});

	test('should pin symbol when cursor is inside a function', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-pin-sym.ts');
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from(
				'const x = 1;\nfunction hello() {\n  return "world";\n}\n',
				'utf-8',
			),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);
			editor.selection = new vscode.Selection(2, 0, 2, 0);

			await vscode.commands.executeCommand('codeAtlas.pinCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.strictEqual(files.length, 1);

			const fileUri = vscode.Uri.joinPath(outputDir, files[0][0]);
			const text = Buffer.from(
				await vscode.workspace.fs.readFile(fileUri),
			).toString('utf-8');
			assert.ok(text.includes('symbol: hello'));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});
});
