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
		// plain text has no symbol provider, so no function will be found
		const doc = await vscode.workspace.openTextDocument({
			content: 'hello',
			language: 'plaintext',
		});
		await vscode.window.showTextDocument(doc);

		// selection is empty by default
		await vscode.commands.executeCommand('codeAtlas.pinCode');

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
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from(content, 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);

			// select line 2-3
			editor.selection = new vscode.Selection(1, 0, 2, 5);

			await vscode.commands.executeCommand('codeAtlas.pinCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.ok(files.length >= 1);

			// file content correctness is tested in pin.test.ts
			const [fileName] = files[0];
			assert.ok(fileName.endsWith('_tmp-test-file-ts.md'));
			assert.ok(/^\d{8}-\d{6}_/.test(fileName));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});

	test('should expand partial selection to full lines', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-test-partial.ts');
		const content = 'aaa\nbbbb\ncccc\nddd\n';
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from(content, 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);

			// select from middle of line 2 to middle of line 3
			editor.selection = new vscode.Selection(1, 2, 2, 1);

			await vscode.commands.executeCommand('codeAtlas.pinCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.ok(files.length >= 1);

			const [fileName] = files[0];
			const fileUri = vscode.Uri.joinPath(outputDir, fileName);
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const text = Buffer.from(bytes).toString('utf-8');

			// should contain full lines, not partial
			assert.ok(text.includes('bbbb\ncccc'));
			assert.ok(text.includes('range: L2-L3'));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});

	test('should pin entire function when cursor is inside it with no selection', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-test-func.ts');
		const content =
			'const x = 1;\nfunction hello() {\n  return "world";\n}\nconst y = 2;\n';
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from(content, 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);

			// place cursor inside the function body, no selection
			editor.selection = new vscode.Selection(2, 0, 2, 0);

			await vscode.commands.executeCommand('codeAtlas.pinCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.ok(files.length >= 1);

			const [fileName] = files[0];
			const fileUri = vscode.Uri.joinPath(outputDir, fileName);
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const text = Buffer.from(bytes).toString('utf-8');

			assert.ok(text.includes('function hello()'));
			assert.ok(text.includes('return "world"'));
			assert.ok(text.includes('range: L2-L4'));
			assert.ok(text.includes('symbol: hello'));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});

	test('should pin innermost function when cursor is in nested function', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-test-nested.ts');
		const content =
			'function outer() {\n  function inner() {\n    return 42;\n  }\n}\n';
		await vscode.workspace.fs.writeFile(
			tmpFileUri,
			Buffer.from(content, 'utf-8'),
		);

		try {
			const doc = await vscode.workspace.openTextDocument(tmpFileUri);
			const editor = await vscode.window.showTextDocument(doc);

			// place cursor inside inner function
			editor.selection = new vscode.Selection(2, 0, 2, 0);

			await vscode.commands.executeCommand('codeAtlas.pinCode');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.ok(files.length >= 1);

			const [fileName] = files[0];
			const fileUri = vscode.Uri.joinPath(outputDir, fileName);
			const bytes = await vscode.workspace.fs.readFile(fileUri);
			const text = Buffer.from(bytes).toString('utf-8');

			// should contain inner, not outer
			assert.ok(text.includes('function inner()'));
			assert.ok(text.includes('return 42'));
			assert.ok(!text.includes('function outer()'));
			assert.ok(text.includes('symbol: outer.inner'));
		} finally {
			await vscode.workspace.fs.delete(tmpFileUri);
		}
	});
});
