import * as assert from 'assert';
import { formatRecord, generateFileName } from '../utils/format';
import type { SelectionInfo } from '../utils/editor';

suite('format', () => {
	const baseInfo: SelectionInfo = {
		filePath: 'src/example.ts',
		fileName: 'example.ts',
		startLine: 10,
		endLine: 24,
		selectedText: 'const x = 1;',
		languageId: 'typescript',
	};
	const fixedDate = new Date('2026-03-22T12:34:56Z');

	suite('formatRecord', () => {
		test('should produce exact output for typescript file', () => {
			const result = formatRecord(baseInfo, fixedDate);
			const expected = [
				'---',
				'file: src/example.ts',
				'range: 10-24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'---',
				'',
				'# Notes',
				'',
				'<!-- write notes here -->',
				'',
				'# Code',
				'',
				'[src/example.ts#L10-L24](code-atlas:src/example.ts#L10-L24)',
				'',
				'```ts',
				'const x = 1;',
				'```',
				'',
			].join('\n');
			assert.strictEqual(result, expected);
		});

		test('should use cpp language tag for cpp languageId', () => {
			const info: SelectionInfo = { ...baseInfo, languageId: 'cpp' };
			const result = formatRecord(info, fixedDate);
			assert.ok(result.includes('```cpp\n'));
		});

		test('should fall back to languageId for unknown language', () => {
			const info: SelectionInfo = { ...baseInfo, languageId: 'unknown' };
			const result = formatRecord(info, fixedDate);
			assert.ok(result.includes('```unknown\n'));
		});
	});

	suite('generateFileName', () => {
		test('should format as YYYYMMDD-HHmmss-<filename>.md', () => {
			const result = generateFileName(baseInfo, fixedDate);
			assert.strictEqual(result, '20260322-123456-example.ts.md');
		});

		test('should zero-pad single digit month and day', () => {
			const date = new Date('2026-01-05T03:07:09Z');
			const result = generateFileName(baseInfo, date);
			assert.strictEqual(result, '20260105-030709-example.ts.md');
		});
	});
});
