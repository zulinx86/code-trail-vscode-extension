import * as assert from 'assert';
import * as vscode from 'vscode';
import { getSymbolAtPosition, getSymbolPos } from '../../utils/symbol';

suite('symbol', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	async function createTsFile(
		name: string,
		content: string,
	): Promise<vscode.Uri> {
		const uri = vscode.Uri.joinPath(workspaceUri, name);
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc);
		await waitForSymbols(uri);
		return uri;
	}

	async function waitForSymbols(
		uri: vscode.Uri,
		timeout = 1000,
	): Promise<void> {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			const symbols = await vscode.commands.executeCommand<
				vscode.DocumentSymbol[]
			>('vscode.executeDocumentSymbolProvider', uri);
			if (symbols?.length) {
				return;
			}
			await new Promise((r) => setTimeout(r, 100));
		}
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
				'tmp-sym-at-nested.ts',
				'function outer() {\n  function inner() {\n    return 1;\n  }\n}\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(2, 0));
				assert.ok(info, 'should find symbol');
				assert.strictEqual(info.name, 'outer.inner');
				assert.strictEqual(info.kind, 'function');
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return outer function when position is outside inner', async () => {
			const uri = await createTsFile(
				'tmp-sym-at-outer.ts',
				'function outer() {\n  const x = 1;\n  function inner() {}\n}\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(1, 0));
				assert.ok(info, 'should find symbol');
				assert.strictEqual(info.name, 'outer');
				assert.strictEqual(info.kind, 'function');
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return class method at position', async () => {
			const uri = await createTsFile(
				'tmp-sym-at-method.ts',
				'class Foo {\n  bar() {\n    return 42;\n  }\n}\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(2, 0));
				assert.ok(info, 'should find symbol');
				assert.strictEqual(info.name, 'Foo.bar');
				assert.strictEqual(info.kind, 'method');
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return class at position', async () => {
			const uri = await createTsFile(
				'tmp-sym-at-class.ts',
				'class Foo {\n  x = 1;\n}\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				assert.ok(info, 'should find symbol');
				assert.strictEqual(info.name, 'Foo');
				assert.strictEqual(info.kind, 'class');
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return interface at position', async () => {
			const uri = await createTsFile(
				'tmp-sym-at-iface.ts',
				'interface Bar {\n  x: number;\n}\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				assert.ok(info, 'should find symbol');
				assert.strictEqual(info.name, 'Bar');
				assert.strictEqual(info.kind, 'interface');
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return enum at position', async () => {
			const uri = await createTsFile(
				'tmp-sym-at-enum.ts',
				'enum Color {\n  Red,\n  Blue,\n}\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				assert.ok(info, 'should find symbol');
				assert.strictEqual(info.name, 'Color');
				assert.strictEqual(info.kind, 'enum');
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return kind as other for unmapped symbol kinds', async () => {
			const uri = await createTsFile(
				'tmp-sym-at-var.ts',
				'const x = 1;\nexport { x };\n',
			);
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				if (info) {
					assert.strictEqual(info.kind, 'other');
				}
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return undefined when no symbol at position', async () => {
			const uri = await createTsFile('tmp-sym-at-none.ts', 'const x = 1;\n');
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				assert.strictEqual(info, undefined);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return undefined for a file with no symbol provider', async () => {
			const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-sym-at-plain.txt');
			await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				assert.strictEqual(info, undefined);
			} finally {
				await deleteSilently(uri);
			}
		});
	});

	suite('getSymbolPos', () => {
		test('should return position for a top-level function', async () => {
			const uri = await createTsFile(
				'tmp-sym-pos-toplevel.ts',
				'function greet() {\n  return "hi";\n}\n',
			);
			try {
				const pos = await getSymbolPos(uri, 'greet');
				assert.ok(pos, 'should find symbol greet');
				assert.strictEqual(pos.line, 0);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return position for a nested function using qualified name', async () => {
			const uri = await createTsFile(
				'tmp-sym-pos-nested.ts',
				'function outer() {\n  function inner() {\n    return 1;\n  }\n}\n',
			);
			try {
				const pos = await getSymbolPos(uri, 'outer.inner');
				assert.ok(pos, 'should find symbol outer.inner');
				assert.strictEqual(pos.line, 1);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return position for a class method', async () => {
			const uri = await createTsFile(
				'tmp-sym-pos-method.ts',
				'class Foo {\n  bar() {\n    return 42;\n  }\n}\n',
			);
			try {
				const pos = await getSymbolPos(uri, 'Foo.bar');
				assert.ok(pos, 'should find symbol Foo.bar');
				assert.strictEqual(pos.line, 1);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return undefined for a non-existent symbol', async () => {
			const uri = await createTsFile(
				'tmp-sym-pos-missing.ts',
				'function exists() {}\n',
			);
			try {
				const pos = await getSymbolPos(uri, 'doesNotExist');
				assert.strictEqual(pos, undefined);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should return undefined for a file with no symbol provider', async () => {
			const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-sym-pos-plain.txt');
			await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
			try {
				const pos = await getSymbolPos(uri, 'anything');
				assert.strictEqual(pos, undefined);
			} finally {
				await deleteSilently(uri);
			}
		});
	});
});
