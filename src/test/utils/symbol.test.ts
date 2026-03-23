import * as assert from 'assert';
import * as vscode from 'vscode';
import { getSymbolRange } from '../../utils/symbol';

suite('getSymbolRange', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	async function createTsFile(
		name: string,
		content: string,
	): Promise<vscode.Uri> {
		const uri = vscode.Uri.joinPath(workspaceUri, name);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc);
		// Wait for the language server to be ready
		await new Promise((r) => setTimeout(r, 500));
		return uri;
	}

	async function deleteSilently(uri: vscode.Uri) {
		try {
			await vscode.workspace.fs.delete(uri);
		} catch {
			// ignore
		}
	}

	test('should return selectionRange for a top-level function', async () => {
		const uri = await createTsFile(
			'tmp-sym-toplevel.ts',
			'function greet() {\n  return "hi";\n}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'greet');
			assert.ok(range, 'should find symbol greet');
			assert.strictEqual(range.start.line, 0);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return selectionRange for a nested function using qualified name', async () => {
		const uri = await createTsFile(
			'tmp-sym-nested.ts',
			'function outer() {\n  function inner() {\n    return 1;\n  }\n}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'outer.inner');
			assert.ok(range, 'should find symbol outer.inner');
			assert.strictEqual(range.start.line, 1);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return selectionRange for a class method', async () => {
		const uri = await createTsFile(
			'tmp-sym-method.ts',
			'class Foo {\n  bar() {\n    return 42;\n  }\n}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'Foo.bar');
			assert.ok(range, 'should find symbol Foo.bar');
			assert.strictEqual(range.start.line, 1);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return undefined for a non-existent symbol', async () => {
		const uri = await createTsFile(
			'tmp-sym-missing.ts',
			'function exists() {}\n',
		);
		try {
			const range = await getSymbolRange(uri, 'doesNotExist');
			assert.strictEqual(range, undefined);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return undefined for a file with no symbol provider', async () => {
		const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-sym-plain.txt');
		await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
		try {
			const range = await getSymbolRange(uri, 'anything');
			assert.strictEqual(range, undefined);
		} finally {
			await deleteSilently(uri);
		}
	});
});
