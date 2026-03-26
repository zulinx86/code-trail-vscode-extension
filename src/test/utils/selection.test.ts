import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildSelectionInfo } from '../../utils/selection';

suite('selection', () => {
	suite('buildSelectionInfo', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

		async function openTsFile(
			name: string,
			content: string,
		): Promise<vscode.TextDocument> {
			const uri = vscode.Uri.joinPath(workspaceUri, name);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
			return vscode.workspace.openTextDocument(uri);
		}

		async function deleteSilently(uri: vscode.Uri) {
			try {
				await vscode.workspace.fs.delete(uri);
			} catch {}
		}

		test('should return correct SelectionInfo for a range', async () => {
			const doc = await openTsFile('tmp-sel-basic.ts', 'line0\nline1\nline2\n');
			try {
				const range = new vscode.Range(0, 0, 1, 5);
				const info = buildSelectionInfo(doc, range);
				assert.strictEqual(info.filePath, 'tmp-sel-basic.ts');
				assert.strictEqual(info.fileName, 'tmp-sel-basic.ts');
				assert.strictEqual(info.startLine, 1);
				assert.strictEqual(info.endLine, 2);
				assert.strictEqual(info.selectedText, 'line0\nline1');
				assert.strictEqual(info.languageId, 'typescript');
				assert.strictEqual(info.symbol, undefined);
				assert.strictEqual(info.symbolKind, undefined);
			} finally {
				await deleteSilently(doc.uri);
			}
		});

		test('should expand partial selection to full lines', async () => {
			const doc = await openTsFile('tmp-sel-partial.ts', 'abcdef\nghijkl\n');
			try {
				const range = new vscode.Range(0, 2, 1, 3);
				const info = buildSelectionInfo(doc, range);
				assert.strictEqual(info.selectedText, 'abcdef\nghijkl');
			} finally {
				await deleteSilently(doc.uri);
			}
		});

		test('should include symbol name and kind when provided', async () => {
			const doc = await openTsFile('tmp-sel-symbol.ts', 'function foo() {}\n');
			try {
				const range = new vscode.Range(0, 0, 0, 17);
				const info = buildSelectionInfo(doc, range, { name: 'foo', kind: 'function', range });
				assert.strictEqual(info.symbol, 'foo');
				assert.strictEqual(info.symbolKind, 'function');
			} finally {
				await deleteSilently(doc.uri);
			}
		});
	});
});
