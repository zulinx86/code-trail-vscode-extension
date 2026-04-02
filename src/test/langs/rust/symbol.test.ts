import * as assert from 'assert';
import * as vscode from 'vscode';
import { Symbol } from '../../../utils/symbol';
import { openFixture, waitForSymbols } from '../../helpers';

suite('symbol (Rust)', () => {
	suite('findSymbolAtPosition', () => {
		test('should return const', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L1: const MY_CONST
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(0, 6),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MY_CONST');
			assert.strictEqual(symbol.kind, 'const');
		});

		test('should return enum', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L25: enum MyEnum
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(24, 5),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyEnum');
			assert.strictEqual(symbol.kind, 'enum');
		});

		test('should return function', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L3: fn my_function() {}
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(2, 3),
			);
			assert.ok(symbol);
			assert.strictEqual(symbol.name, 'my_function');
			assert.strictEqual(symbol.kind, 'function');
		});

		test('should return nested function', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L7: let _ = 1; (inside my_inner_function)
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(6, 8),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'my_outer_function.my_inner_function');
			assert.strictEqual(symbol.kind, 'function');
		});

		test('should return struct', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L11: struct MyStruct
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(10, 7),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyStruct');
			assert.strictEqual(symbol.kind, 'struct');
		});

		test('should return method in impl block', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			// L17: self.x (inside my_method)
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(16, 8),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'impl MyStruct.my_method');
			assert.strictEqual(symbol.kind, 'method');
		});

		test('should return trait as interface', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L21: trait MyTrait
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(20, 6),
			);
			assert.ok(symbol, `should find symbol`);
			assert.strictEqual(symbol.name, 'MyTrait');
			assert.strictEqual(symbol.kind, 'interface');
		});

		test('should return trait method', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L22: fn my_trait_method
			const symbol = await Symbol.findSymbolAtPosition(
				doc.uri,
				new vscode.Position(21, 7),
			);
			assert.ok(symbol, 'should find symbol');
			assert.strictEqual(symbol.name, 'MyTrait.my_trait_method');
			assert.strictEqual(symbol.kind, 'method');
		});
	});
});
