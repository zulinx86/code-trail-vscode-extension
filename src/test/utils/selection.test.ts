import * as assert from 'assert';
import * as vscode from 'vscode';
import { Selection } from '../../utils/selection';
import { openFixture } from '../helpers';

suite('selection', () => {
	suite('constructor', () => {
		test('should store all fields correctly', () => {
			const sel = new Selection(
				'src/index.ts',
				1,
				2,
				'line0\nline1',
				'typescript',
			);
			assert.strictEqual(sel.filePath, 'src/index.ts');
			assert.strictEqual(sel.startLine, 1);
			assert.strictEqual(sel.endLine, 2);
			assert.strictEqual(sel.selectedText, 'line0\nline1');
			assert.strictEqual(sel.languageId, 'typescript');
			assert.strictEqual(sel.symbol, undefined);
			assert.strictEqual(sel.symbolKind, undefined);
		});

		test('should include symbol name and kind when provided', () => {
			const sel = new Selection(
				'src/index.ts',
				3,
				3,
				'function myFunction() {}',
				'typescript',
				'myFunction',
				'function',
			);
			assert.strictEqual(sel.symbol, 'myFunction');
			assert.strictEqual(sel.symbolKind, 'function');
		});
	});
});
