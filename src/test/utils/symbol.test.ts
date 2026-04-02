import * as assert from 'assert';
import * as vscode from 'vscode';
import { Symbol } from '../../utils/symbol';
import { openFixture, waitForSymbols } from '../helpers';

suite('symbol', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	suite('findSymbolAtPosition', () => {
		test('should return innermost function at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L7: inside myInnerFunction
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(6, 0),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'myOuterFunction.myInnerFunction');
			assert.strictEqual(symbol.kind, 'function');
		});

		test('should return outer function when position is outside inner', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L5: function myOuterFunction() { line
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(4, 0),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'myOuterFunction');
			assert.strictEqual(symbol.kind, 'function');
		});

		test('should return class method at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L13: inside myMethod
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(12, 0),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyClass.myMethod');
			assert.strictEqual(symbol.kind, 'method');
		});

		test('should return class at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L11: class MyClass
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(10, 0),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyClass');
			assert.strictEqual(symbol.kind, 'class');
		});

		test('should return interface at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L17: interface MyInterface
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(16, 0),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyInterface');
			assert.strictEqual(symbol.kind, 'interface');
		});

		test('should return enum at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L21: enum MyEnum
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(20, 0),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyEnum');
			assert.strictEqual(symbol.kind, 'enum');
		});

		test('should return kind as other for unmapped symbol kinds', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L1: const myConst
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(0, 0),
			);
			if (symbol) {
				assert.strictEqual(symbol.kind, 'other');
			}
		});

		test('should return undefined for a file with no symbol provider', async () => {
			const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-plain.txt');
			await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
			try {
				const symbol = await Symbol.findSymbolAtPosition(
					uri,
					new vscode.Position(0, 0),
				);
				assert.strictEqual(symbol, undefined);
			} finally {
				try {
					await vscode.workspace.fs.delete(uri);
				} catch {}
			}
		});
	});

	suite('findSymbolByName', () => {
		test('should return position for a top-level function', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const symbol = await Symbol.findSymbolByName(doc.uri, 'myFunction');
			assert.ok(symbol, 'should find symbol myFunction');
			assert.strictEqual(symbol.range.start.line, 2);
		});

		test('should return position for a nested function using qualified name', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const symbol = await Symbol.findSymbolByName(
				doc.uri,
				'myOuterFunction.myInnerFunction',
			);
			assert.ok(symbol, 'should find symbol myOuterFunction.myInnerFunction');
			assert.strictEqual(symbol.range.start.line, 5);
		});

		test('should return position for a class method', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const symbol = await Symbol.findSymbolByName(doc.uri, 'MyClass.myMethod');
			assert.ok(symbol, 'should find symbol MyClass.myMethod');
			assert.strictEqual(symbol.range.start.line, 11);
		});

		test('should return undefined for a non-existent symbol', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const symbol = await Symbol.findSymbolByName(doc.uri, 'doesNotExist');
			assert.strictEqual(symbol, undefined);
		});

		test('should return undefined for a file with no symbol provider', async () => {
			const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-plain.txt');
			await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
			try {
				const symbol = await Symbol.findSymbolByName(uri, 'anything');
				assert.strictEqual(symbol, undefined);
			} finally {
				try {
					await vscode.workspace.fs.delete(uri);
				} catch {}
			}
		});
	});
});
