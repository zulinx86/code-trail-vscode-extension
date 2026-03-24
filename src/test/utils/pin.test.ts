import * as assert from 'assert';
import * as vscode from 'vscode';
import { formatPin, generatePinFileName, savePin } from '../../utils/pin';
import type { SelectionInfo } from '../../utils/selection';

suite('pin', () => {
	const baseInfo: SelectionInfo = {
		filePath: 'src/example.ts',
		fileName: 'example.ts',
		startLine: 10,
		endLine: 24,
		selectedText: 'const x = 1;',
		languageId: 'typescript',
	};
	const fixedDate = new Date('2026-03-22T12:34:56Z');

	suite('formatPin', () => {
		test('should produce exact output for typescript file', () => {
			const result = formatPin(baseInfo, fixedDate);
			const expected = [
				'---',
				'file: src/example.ts',
				'range: L10-L24',
				'link: code-atlas:src/example.ts#L10-L24',
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
			const result = formatPin(info, fixedDate);
			assert.ok(result.includes('```cpp\n'));
		});

		test('should fall back to languageId for unknown language', () => {
			const info: SelectionInfo = { ...baseInfo, languageId: 'unknown' };
			const result = formatPin(info, fixedDate);
			assert.ok(result.includes('```unknown\n'));
		});

		test('should include github url in frontmatter when provided', () => {
			const url =
				'https://github.com/user/repo/blob/abc123/src/example.ts#L10-L24';
			const result = formatPin(baseInfo, fixedDate, url);
			assert.ok(result.includes(`github: ${url}`));
		});

		test('should omit github field when url is not provided', () => {
			const result = formatPin(baseInfo, fixedDate);
			assert.ok(!result.includes('github:'));
		});

		test('should include symbol in frontmatter when provided', () => {
			const info: SelectionInfo = {
				...baseInfo,
				symbol: 'Server.handleRequest',
			};
			const result = formatPin(info, fixedDate);
			assert.ok(result.includes('symbol: Server.handleRequest'));
		});

		test('should omit symbol field when not provided', () => {
			const result = formatPin(baseInfo, fixedDate);
			assert.ok(!result.includes('symbol:'));
		});
	});

	suite('generatePinFileName', () => {
		test('should format as YYYYMMDD-HHmmss_filename.md', () => {
			const result = generatePinFileName(baseInfo, fixedDate);
			assert.strictEqual(result, '20260322-123456_example-ts.md');
		});

		test('should zero-pad single digit month and day', () => {
			const date = new Date('2026-01-05T03:07:09Z');
			const result = generatePinFileName(baseInfo, date);
			assert.strictEqual(result, '20260105-030709_example-ts.md');
		});

		test('should include symbol name when provided', () => {
			const info: SelectionInfo = {
				...baseInfo,
				symbol: 'Foo.bar',
			};
			const result = generatePinFileName(info, fixedDate);
			assert.strictEqual(result, '20260322-123456_example-ts_Foo-bar.md');
		});
	});

	suite('savePin', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-atlas');

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should create file in code-atlas directory', async () => {
			const uri = await savePin(baseInfo, fixedDate);
			const content = Buffer.from(
				await vscode.workspace.fs.readFile(uri),
			).toString('utf-8');
			assert.ok(content.includes('file: src/example.ts'));
			assert.ok(
				uri.fsPath.endsWith('code-atlas/20260322-123456_example-ts.md'),
			);
		});

		test('should create code-atlas directory if it does not exist', async () => {
			try {
				await vscode.workspace.fs.stat(outputDir);
				assert.fail('directory should not exist before test');
			} catch {}

			await savePin(baseInfo, fixedDate);

			const stat = await vscode.workspace.fs.stat(outputDir);
			assert.strictEqual(stat.type, vscode.FileType.Directory);
		});
	});
});
