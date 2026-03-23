import * as assert from 'assert';
import { parseFrontmatter } from '../../utils/frontmatter';

suite('frontmatter', () => {
	suite('parseFrontmatter', () => {
		test('should parse basic frontmatter', () => {
			const text = [
				'---',
				'file: src/example.ts',
				'range: L10-L24',
				'link: code-atlas:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'---',
				'',
				'# Notes',
			].join('\n');
			const fm = parseFrontmatter(text);
			assert.ok(fm);
			assert.strictEqual(fm.file, 'src/example.ts');
			assert.strictEqual(fm.startLine, 10);
			assert.strictEqual(fm.endLine, 24);
			assert.strictEqual(fm.symbol, undefined);
			assert.strictEqual(fm.uses, undefined);
			assert.strictEqual(fm.usedBy, undefined);
		});

		test('should parse frontmatter with symbol', () => {
			const text = [
				'---',
				'file: src/example.ts',
				'symbol: Server.handleRequest',
				'range: L10-L24',
				'link: code-atlas:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'---',
			].join('\n');
			const fm = parseFrontmatter(text);
			assert.ok(fm);
			assert.strictEqual(fm.symbol, 'Server.handleRequest');
		});

		test('should parse frontmatter with uses and usedBy', () => {
			const text = [
				'---',
				'file: src/example.ts',
				'range: L10-L24',
				'link: code-atlas:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'uses:',
				'  - 20260322-123500-validator.ts.md',
				'  - 20260322-123600-handler.ts.md',
				'usedBy:',
				'  - 20260322-123400-main.ts.md',
				'---',
			].join('\n');
			const fm = parseFrontmatter(text);
			assert.ok(fm);
			assert.deepStrictEqual(fm.uses, [
				'20260322-123500-validator.ts.md',
				'20260322-123600-handler.ts.md',
			]);
			assert.deepStrictEqual(fm.usedBy, ['20260322-123400-main.ts.md']);
		});

		test('should return undefined for invalid frontmatter', () => {
			assert.strictEqual(parseFrontmatter('no frontmatter'), undefined);
		});

		test('should return undefined when required fields are missing', () => {
			const text = ['---', 'file: src/example.ts', '---'].join('\n');
			assert.strictEqual(parseFrontmatter(text), undefined);
		});
	});
});
