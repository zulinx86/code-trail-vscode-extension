import * as assert from 'assert';
import * as vscode from 'vscode';
import { saveFile } from '../../utils/file';

suite('file', () => {
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

	suite('saveFile', () => {
		test('should create file in code-atlas directory', async () => {
			const uri = await saveFile('test-save.md', '# hello');

			const bytes = await vscode.workspace.fs.readFile(uri);
			assert.strictEqual(Buffer.from(bytes).toString('utf-8'), '# hello');
			assert.ok(uri.fsPath.endsWith('code-atlas/test-save.md'));
		});

		test('should create code-atlas directory if it does not exist', async () => {
			// Ensure directory does not exist
			try {
				await vscode.workspace.fs.stat(outputDir);
				assert.fail('directory should not exist before test');
			} catch {
				// expected
			}

			await saveFile('test-mkdir.md', 'content');

			const stat = await vscode.workspace.fs.stat(outputDir);
			assert.strictEqual(stat.type, vscode.FileType.Directory);
		});

		test('should overwrite existing file', async () => {
			await saveFile('test-overwrite.md', 'first');
			await saveFile('test-overwrite.md', 'second');

			const uri = vscode.Uri.joinPath(outputDir, 'test-overwrite.md');
			const bytes = await vscode.workspace.fs.readFile(uri);
			assert.strictEqual(Buffer.from(bytes).toString('utf-8'), 'second');
		});
	});
});
