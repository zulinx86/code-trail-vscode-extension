import * as assert from 'assert';
import * as vscode from 'vscode';
import { workspaceFolder } from '../../config';
import { Mark } from '../../utils/mark';

suite('addTitle command', () => {
	const workspaceUri = workspaceFolder!.uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	async function cleanup() {
		try {
			await vscode.workspace.fs.delete(outputDir, { recursive: true });
		} catch {}
	}

	setup(cleanup);
	teardown(cleanup);

	test('should do nothing when input is cancelled', async () => {
		const orig = vscode.window.showInputBox;
		(vscode.window as any).showInputBox = async () => undefined;

		try {
			await vscode.commands.executeCommand('codeTrail.addTitle');

			try {
				await vscode.workspace.fs.stat(outputDir);
				assert.fail('output directory should not exist');
			} catch {
				// expected
			}
		} finally {
			(vscode.window as any).showInputBox = orig;
		}
	});

	test('should create a title mark file', async () => {
		const orig = vscode.window.showInputBox;
		(vscode.window as any).showInputBox = async () => 'Test Title';

		try {
			await vscode.commands.executeCommand('codeTrail.addTitle');

			const entries = await vscode.workspace.fs.readDirectory(outputDir);
			const files = entries.filter(([, type]) => type === vscode.FileType.File);
			assert.strictEqual(files.length, 1);

			const fileUri = vscode.Uri.joinPath(outputDir, files[0][0]);
			const text = Buffer.from(
				await vscode.workspace.fs.readFile(fileUri),
			).toString('utf-8');
			assert.ok(text.includes('symbol: Test Title'));
			assert.ok(text.includes('symbolKind: title'));
			assert.ok(text.includes('file: (title)'));
		} finally {
			(vscode.window as any).showInputBox = orig;
		}
	});

	test('should open the created mark file in editor', async () => {
		const orig = vscode.window.showInputBox;
		(vscode.window as any).showInputBox = async () => 'Editor Test';

		try {
			await vscode.commands.executeCommand('codeTrail.addTitle');

			const editor = vscode.window.activeTextEditor;
			assert.ok(editor, 'should have an active editor');
			assert.ok(
				editor.document.uri.fsPath.includes('code-trail'),
				'active file should be in code-trail directory',
			);
		} finally {
			(vscode.window as any).showInputBox = orig;
		}
	});
});
