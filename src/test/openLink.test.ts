import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeAtlasLinkProvider } from '../providers/linkProvider';

suite('openLink command', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	suiteSetup(async () => {
		// ensure the extension is activated
		await vscode.commands.executeCommand('codeAtlas.bookmarkSelection');
	});

	test('should open file and move cursor to startLine', async () => {
		const tmpFileUri = vscode.Uri.joinPath(workspaceUri, 'tmp-test-openlink.ts');
		const content = 'line1\nline2\nline3\nline4\nline5\n';
		await vscode.workspace.fs.writeFile(tmpFileUri, Buffer.from(content, 'utf-8'));

		try {
			await vscode.commands.executeCommand('codeAtlas.openLink', {
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

suite('CodeAtlasLinkProvider', () => {
	const provider = new CodeAtlasLinkProvider();

	test('should detect code-atlas: link in markdown', async () => {
		const content = '[src/editor.ts#L10-L24](code-atlas:src/editor.ts#L10-L24)';
		const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 1);
		assert.ok(links[0].target?.toString().includes('codeAtlas.openLink'));
	});

	test('should detect multiple links', async () => {
		const content = [
			'[a.ts#L1-L2](code-atlas:a.ts#L1-L2)',
			'some text',
			'[b.ts#L3-L4](code-atlas:b.ts#L3-L4)',
		].join('\n');
		const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 2);
	});

	test('should return no links for plain text', async () => {
		const content = 'no links here';
		const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 0);
	});
});
