import * as assert from 'assert';
import * as vscode from 'vscode';
import { getSymbolAtPosition, getSymbolPos } from '../../utils/symbol';
import { openFixture, waitForSymbols } from '../helpers';

suite('symbol', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	suite('getSymbolAtPosition', () => {
		test('should return innermost function at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L7: inside myInnerFunction
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(6, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'myOuterFunction.myInnerFunction');
			assert.strictEqual(info.kind, 'function');
		});

		test('should return outer function when position is outside inner', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L5: function myOuterFunction() { line
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(4, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'myOuterFunction');
			assert.strictEqual(info.kind, 'function');
		});

		test('should return class method at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L13: inside myMethod
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(12, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'MyClass.myMethod');
			assert.strictEqual(info.kind, 'method');
		});

		test('should return class at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L11: class MyClass
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(10, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'MyClass');
			assert.strictEqual(info.kind, 'class');
		});

		test('should return interface at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L17: interface MyInterface
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(16, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'MyInterface');
			assert.strictEqual(info.kind, 'interface');
		});

		test('should return enum at position', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L21: enum MyEnum
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(20, 0),
			);
			assert.ok(info, 'should find symbol');
			assert.strictEqual(info.name, 'MyEnum');
			assert.strictEqual(info.kind, 'enum');
		});

		test('should return kind as other for unmapped symbol kinds', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			// L1: const myConst
			const info = await getSymbolAtPosition(
				doc.uri,
				new vscode.Position(0, 0),
			);
			if (info) {
				assert.strictEqual(info.kind, 'other');
			}
		});

		test('should return undefined for a file with no symbol provider', async () => {
			const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-plain.txt');
			await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
			try {
				const info = await getSymbolAtPosition(uri, new vscode.Position(0, 0));
				assert.strictEqual(info, undefined);
			} finally {
				try {
					await vscode.workspace.fs.delete(uri);
				} catch {}
			}
		});
	});

	suite('getSymbolPos', () => {
		test('should return position for a top-level function', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const pos = await getSymbolPos(doc.uri, 'myFunction');
			assert.ok(pos, 'should find symbol myFunction');
			assert.strictEqual(pos.line, 2);
		});

		test('should return position for a nested function using qualified name', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const pos = await getSymbolPos(
				doc.uri,
				'myOuterFunction.myInnerFunction',
			);
			assert.ok(pos, 'should find symbol myOuterFunction.myInnerFunction');
			assert.strictEqual(pos.line, 5);
		});

		test('should return position for a class method', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const pos = await getSymbolPos(doc.uri, 'MyClass.myMethod');
			assert.ok(pos, 'should find symbol MyClass.myMethod');
			assert.strictEqual(pos.line, 11);
		});

		test('should return undefined for a non-existent symbol', async () => {
			const doc = await openFixture('typescript/index.ts');
			await waitForSymbols(doc.uri);
			const pos = await getSymbolPos(doc.uri, 'doesNotExist');
			assert.strictEqual(pos, undefined);
		});

		test('should return undefined for a file with no symbol provider', async () => {
			const uri = vscode.Uri.joinPath(workspaceUri, 'tmp-plain.txt');
			await vscode.workspace.fs.writeFile(uri, Buffer.from('hello', 'utf-8'));
			try {
				const pos = await getSymbolPos(uri, 'anything');
				assert.strictEqual(pos, undefined);
			} finally {
				try {
					await vscode.workspace.fs.delete(uri);
				} catch {}
			}
		});
	});
});
