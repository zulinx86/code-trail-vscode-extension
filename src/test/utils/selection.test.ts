import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildSelectionInfo } from '../../utils/selection';
import { openFixture } from '../helpers';

suite('selection', () => {
	suite('buildSelectionInfo', () => {
		test('should return correct SelectionInfo for a range', async () => {
			const doc = await openFixture('plain-text.ts');
			const range = new vscode.Range(0, 0, 1, 5);
			const info = buildSelectionInfo(doc, range);
			assert.strictEqual(info.fileName, 'plain-text.ts');
			assert.strictEqual(info.startLine, 1);
			assert.strictEqual(info.endLine, 2);
			assert.strictEqual(info.selectedText, 'line0\nline1');
			assert.strictEqual(info.languageId, 'typescript');
			assert.strictEqual(info.symbol, undefined);
			assert.strictEqual(info.symbolKind, undefined);
		});

		test('should expand partial selection to full lines', async () => {
			const doc = await openFixture('plain-text.ts');
			const range = new vscode.Range(0, 2, 1, 3);
			const info = buildSelectionInfo(doc, range);
			assert.strictEqual(info.selectedText, 'line0\nline1');
		});

		test('should include symbol name and kind when provided', async () => {
			const doc = await openFixture('symbols.ts');
			// L3: function myFunction() {}
			const range = new vscode.Range(2, 0, 2, 23);
			const info = buildSelectionInfo(doc, range, {
				name: 'myFunction',
				kind: 'function',
				range,
			});
			assert.strictEqual(info.symbol, 'myFunction');
			assert.strictEqual(info.symbolKind, 'function');
		});
	});
});
