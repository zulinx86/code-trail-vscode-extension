import * as assert from 'assert';
import * as vscode from 'vscode';

suite('markCode command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

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

		await vscode.commands.executeCommand('codeTrail.markCode');

		try {
			await vscode.workspace.fs.stat(outputDir);
			assert.fail('output directory should not exist');
		} catch {
			// expected
		}
	});

	test('should create a mark file from selection', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-mark-sel.ts');
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from('line1\nline2\nline3\n', 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);
			editor.selection = new vscode.Selection(1, 0, 2, 5);

			await vscode.commands.executeCommand('codeTrail.markCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.strictEqual(files.length, 1);
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});

	test('should mark symbol when cursor is inside a function', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-mark-sym.ts');
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

			await vscode.commands.executeCommand('codeTrail.markCode');

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

	test('should not create duplicate mark for same symbol', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-mark-dup.ts');
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from('function greet() {\n  return "hi";\n}\n', 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);
			editor.selection = new vscode.Selection(1, 0, 1, 0);

			// First mark
			await vscode.commands.executeCommand('codeTrail.markCode');
			const entries1 = await vscode.workspace.fs.readDirectory(outputDir);
			const files1 = entries1.filter(
				([, type]) => type === vscode.FileType.File,
			);
			assert.strictEqual(files1.length, 1, 'should create one mark');

			// Re-open source file and place cursor in same function
			const doc2 = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor2 = await vscode.window.showTextDocument(doc2);
			editor2.selection = new vscode.Selection(1, 0, 1, 0);

			// Second mark of same symbol
			await vscode.commands.executeCommand('codeTrail.markCode');
			const entries2 = await vscode.workspace.fs.readDirectory(outputDir);
			const files2 = entries2.filter(
				([, type]) => type === vscode.FileType.File,
			);
			assert.strictEqual(files2.length, 1, 'should not create duplicate mark');
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});
});
