import * as assert from 'assert';
import * as vscode from 'vscode';
import { getSymbolAtPosition, getSymbolRange } from '../../utils/symbol';

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

suite('getSymbolAtPosition', () => {
	test('should return innermost function at position', async () => {
		const uri = await createTsFile(
			'tmp-symat-nested.ts',
			'function outer() {\n  function inner() {\n    return 1;\n  }\n}\n',
		);
		try {
			const info = await getSymbolAtPosition(
				uri,
				new vscode.Position(2, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'outer.inner');
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return outer function when position is outside inner', async () => {
		const uri = await createTsFile(
			'tmp-symat-outer.ts',
			'function outer() {\n  const x = 1;\n  function inner() {}\n}\n',
		);
		try {
			const info = await getSymbolAtPosition(
				uri,
				new vscode.Position(1, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'outer');
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return class method at position', async () => {
		const uri = await createTsFile(
			'tmp-symat-method.ts',
			'class Foo {\n  bar() {\n    return 42;\n  }\n}\n',
		);
		try {
			const info = await getSymbolAtPosition(
				uri,
				new vscode.Position(2, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'Foo.bar');
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return undefined when no symbol at position', async () => {
		const uri = await createTsFile(
			'tmp-symat-none.ts',
			'const x = 1;\n',
		);
		try {
			const info = await getSymbolAtPosition(
				uri,
				new vscode.Position(0, 0),
			);
			assert.strictEqual(info, undefined);
		} finally {
			await deleteSilently(uri);
		}
	});

	test('should return undefined for a file with no symbol provider', async () => {
		const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-symat-plain.txt');
		await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
		try {
			const info = await getSymbolAtPosition(
				uri,
				new vscode.Position(0, 0),
			);
			assert.strictEqual(info, undefined);
		} finally {
			await deleteSilently(uri);
		}
	});
});

suite('getSymbolRange', () => {
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
