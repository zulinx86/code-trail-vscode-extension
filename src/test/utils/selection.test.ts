import * as assert from 'assert';
import * as vscode from 'vscode';
import { Selection } from '../../utils/selection';
import { openFixture } from '../helpers';

suite('selection', () => {
	suite('constructor', () => {
		test('should store all fields correctly', () => {
			const sel = new Selection({
				file: 'src/index.ts',
				startLine: 1,
				endLine: 2,
				selectedText: 'line0\nline1',
			});
			assert.strictEqual(sel.file, 'src/index.ts');
			assert.strictEqual(sel.startLine, 1);
			assert.strictEqual(sel.endLine, 2);
			assert.strictEqual(sel.selectedText, 'line0\nline1');
			assert.strictEqual(sel.symbol, undefined);
			assert.strictEqual(sel.symbolKind, undefined);
		});

		test('should include symbol name and kind when provided', () => {
			const sel = new Selection({
				file: 'src/index.ts',
				startLine: 3,
				endLine: 3,
				selectedText: 'function myFunction() {}',
				symbol: 'myFunction',
				symbolKind: 'function',
			});
			assert.strictEqual(sel.symbol, 'myFunction');
			assert.strictEqual(sel.symbolKind, 'function');
		});
	});
});
