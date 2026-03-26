import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	formatMark,
	generateMarkFileName,
	saveMark,
	findExistingMark,
} from '../../utils/mark';
import type { SelectionInfo } from '../../utils/selection';

suite('mark', () => {
	const baseInfo: SelectionInfo = {
		filePath: 'src/example.ts',
		fileName: 'example.ts',
		startLine: 10,
		endLine: 24,
		selectedText: 'const x = 1;',
		languageId: 'typescript',
	};
	const fixedDate = new Date('2026-03-22T12:34:56Z');

	suite('formatMark', () => {
		test('should produce exact output for typescript file', () => {
			const result = formatMark(baseInfo, fixedDate);
			const expected = [
				'---',
				'file: src/example.ts',
				'range: L10-L24',
				'link: code-trail:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'---',
				'',
				'# Notes',
				'',
				'<!-- write notes here -->',
				'',
				'# Code',
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
			const result = formatMark(info, fixedDate);
			assert.ok(result.includes('```cpp\n'));
		});

		test('should fall back to languageId for unknown language', () => {
			const info: SelectionInfo = { ...baseInfo, languageId: 'unknown' };
			const result = formatMark(info, fixedDate);
			assert.ok(result.includes('```unknown\n'));
		});

		test('should include github url in frontmatter when provided', () => {
			const url =
				'https://github.com/user/repo/blob/abc123/src/example.ts#L10-L24';
			const result = formatMark(baseInfo, fixedDate, url);
			assert.ok(result.includes(`github: ${url}`));
		});

		test('should omit github field when url is not provided', () => {
			const result = formatMark(baseInfo, fixedDate);
			assert.ok(!result.includes('github:'));
		});

		test('should include symbol and symbolKind in frontmatter when provided', () => {
			const info: SelectionInfo = {
				...baseInfo,
				symbol: 'Server.handleRequest',
				symbolKind: 'method',
			};
			const result = formatMark(info, fixedDate);
			assert.ok(result.includes('symbol: Server.handleRequest'));
			assert.ok(result.includes('symbolKind: method'));
		});

		test('should omit symbol and symbolKind fields when not provided', () => {
			const result = formatMark(baseInfo, fixedDate);
			assert.ok(!result.includes('symbol:'));
			assert.ok(!result.includes('symbolKind:'));
		});
	});

	suite('generateMarkFileName', () => {
		test('should format as YYYYMMDD-HHmmss_filename.md', () => {
			const result = generateMarkFileName(baseInfo, fixedDate);
			assert.strictEqual(result, '20260322-123456_example-ts.md');
		});

		test('should zero-pad single digit month and day', () => {
			const date = new Date('2026-01-05T03:07:09Z');
			const result = generateMarkFileName(baseInfo, date);
			assert.strictEqual(result, '20260105-030709_example-ts.md');
		});

		test('should include symbol name when provided', () => {
			const info: SelectionInfo = {
				...baseInfo,
				symbol: 'Foo.bar',
			};
			const result = generateMarkFileName(info, fixedDate);
			assert.strictEqual(result, '20260322-123456_example-ts_Foo-bar.md');
		});

		test('should replace spaces in symbol name with hyphens', () => {
			const info: SelectionInfo = {
				...baseInfo,
				symbol: 'impl Test',
			};
			const result = generateMarkFileName(info, fixedDate);
			assert.strictEqual(result, '20260322-123456_example-ts_impl-Test.md');
		});
	});

	suite('saveMark', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should create file in code-trail directory', async () => {
			const uri = await saveMark(baseInfo, fixedDate);
			const content = Buffer.from(
				await vscode.workspace.fs.readFile(uri),
			).toString('utf-8');
			assert.ok(content.includes('file: src/example.ts'));
			assert.ok(
				uri.fsPath.endsWith('code-trail/20260322-123456_example-ts.md'),
			);
		});

		test('should create code-trail directory if it does not exist', async () => {
			try {
				await vscode.workspace.fs.stat(outputDir);
				assert.fail('directory should not exist before test');
			} catch {}

			await saveMark(baseInfo, fixedDate);

			const stat = await vscode.workspace.fs.stat(outputDir);
			assert.strictEqual(stat.type, vscode.FileType.Directory);
		});
	});

	suite('findExistingMark', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should return existing mark with same file and symbol', async () => {
			const info: SelectionInfo = {
				...baseInfo,
				symbol: 'foo',
				symbolKind: 'function',
			};
			await saveMark(info, fixedDate);
			const existing = await findExistingMark('src/example.ts', 'foo');
			assert.ok(existing);
			assert.strictEqual(existing.fm.file, 'src/example.ts');
			assert.strictEqual(existing.fm.symbol, 'foo');
		});

		test('should return undefined when no matching mark exists', async () => {
			const existing = await findExistingMark('src/example.ts', 'foo');
			assert.strictEqual(existing, undefined);
		});
	});
});
