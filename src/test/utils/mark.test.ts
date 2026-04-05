import * as assert from 'assert';
import * as vscode from 'vscode';
import { Mark, type MarkArgs } from '../../utils/mark';
import { Selection } from '../../utils/selection';
import { OUTPUT_DIR } from '../../config';

suite('mark', () => {
	suite('Mark.fromText', () => {
		test('shoudl parse basic mark', () => {
			const text = [
				'---',
				'file: src/example.ts',
				'range: L10-L24',
				'link: code-trail:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'---',
				'',
				'# Notes',
			].join('\n');
			const mark = Mark.fromText(text);
			assert.ok(mark);
			assert.strictEqual(mark.file, 'src/example.ts');
			assert.strictEqual(mark.startLine, 10);
			assert.strictEqual(mark.endLine, 24);
			assert.strictEqual(mark.symbol, undefined);
			assert.strictEqual(mark.symbolKind, undefined);
			assert.strictEqual(mark.link, 'code-trail:src/example.ts#L10-L24');
			assert.strictEqual(mark.github, undefined);
			assert.strictEqual(mark.exportedAt, '2026-03-22T12:34:56Z');
			assert.strictEqual(mark.uses, undefined);
			assert.strictEqual(mark.usedBy, undefined);
			assert.strictEqual(mark.code, undefined);
		});

		test('should parse mark with symbol and symbolKind', () => {
			const text = [
				'---',
				'file: src/example.ts',
				'symbol: Server.handleRequest',
				'symbolKind: method',
				'range: L10-L24',
				'link: code-trail:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'---',
			].join('\n');
			const mark = Mark.fromText(text);
			assert.ok(mark);
			assert.strictEqual(mark.symbol, 'Server.handleRequest');
			assert.strictEqual(mark.symbolKind, 'method');
		});

		test('should parse mark with uses and usedBy', () => {
			const text = [
				'---',
				'file: src/example.ts',
				'range: L10-L24',
				'link: code-trail:src/example.ts#L10-L24',
				'exportedAt: 2026-03-22T12:34:56Z',
				'uses:',
				'  - code-trail:code-trail/20260322-123500-validator.ts.md',
				'  - code-trail:code-trail/20260322-123600-handler.ts.md',
				'usedBy:',
				'  - code-trail:code-trail/20260322-123400-main.ts.md',
				'---',
			].join('\n');
			const mark = Mark.fromText(text);
			assert.ok(mark);
			assert.deepStrictEqual(mark.uses, [
				'code-trail:code-trail/20260322-123500-validator.ts.md',
				'code-trail:code-trail/20260322-123600-handler.ts.md',
			]);
			assert.deepStrictEqual(mark.usedBy, [
				'code-trail:code-trail/20260322-123400-main.ts.md',
			]);
		});

		test('should return undefined for invalid mark', () => {
			assert.strictEqual(Mark.fromText('no frontmatter'), undefined);
		});

		test('should return undefined when required fields are missing', () => {
			const text = ['---', 'file: src/example.ts', '---'].join('\n');
			assert.strictEqual(Mark.fromText(text), undefined);
		});
	});

	const markArgs: MarkArgs = {
		file: 'src/example.ts',
		startLine: 10,
		endLine: 24,
		link: 'code-trail:src/example.ts#L10-L24',
		exportedAt: new Date('2026-03-22T12:34:56.000Z'),
		code: 'const x = 1;',
	};

	suite('Mark.toString', () => {
		test('should produce exact output for typescript file', () => {
			const result = new Mark(markArgs).toString();
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

		test('should include github url in frontmatter when provided', () => {
			const github =
				'https://github.com/user/repo/blob/abc123/src/example.ts#L10-L24';
			const result = new Mark({ github, ...markArgs }).toString();
			assert.ok(result.includes(`github: ${github}`));
		});

		test('should omit github field when url is not provided', () => {
			const result = new Mark(markArgs).toString();
			assert.ok(!result.includes('github:'));
		});

		test('should include symbol and symbolKind in frontmatter when provided', () => {
			const result = new Mark({
				symbol: 'Server.handleRequest',
				symbolKind: 'method',
				...markArgs,
			}).toString();
			assert.ok(result.includes('symbol: Server.handleRequest'));
			assert.ok(result.includes('symbolKind: method'));
		});

		test('should omit symbol and symbolKind fields when not provided', () => {
			const result = new Mark(markArgs).toString();
			assert.ok(!result.includes('symbol:'));
			assert.ok(!result.includes('symbolKind:'));
		});
	});

	suite('Mark.id', () => {
		test('should format as YYYYMMDD-HHmmss_filename.md', () => {
			const result = new Mark(markArgs).id;
			assert.strictEqual(result, '20260322-123456_example-ts.md');
		});

		test('should include symbol name when provided', () => {
			const result = new Mark({ symbol: 'Foo.bar', ...markArgs }).id;
			assert.strictEqual(result, '20260322-123456_example-ts_Foo-bar.md');
		});

		test('should replace spaces in symbol name with hyphens', () => {
			const result = new Mark({
				symbol: 'impl Test',
				...markArgs,
			}).id;
			assert.strictEqual(result, '20260322-123456_example-ts_impl-Test.md');
		});
	});

	suite('Mark.save', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, OUTPUT_DIR);

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should create file in code-trail directory', async () => {
			const uri = await new Mark(markArgs).save();
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

			await new Mark(markArgs).save();

			const stat = await vscode.workspace.fs.stat(outputDir);
			assert.strictEqual(stat.type, vscode.FileType.Directory);
		});
	});

	suite('Mark.connect', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
		const outputDir = vscode.Uri.joinPath(workspaceUri, OUTPUT_DIR);

		async function cleanup() {
			try {
				await vscode.workspace.fs.delete(outputDir, { recursive: true });
			} catch {}
		}

		setup(cleanup);
		teardown(cleanup);

		test('should create field and add connection when field does not exist', async () => {
			const mark = new Mark(markArgs);
			await mark.connect('uses', 'target.md');
			assert.deepStrictEqual(mark.uses, ['code-trail:code-trail/target.md']);
		});

		test('should append to existing field', async () => {
			const mark = new Mark({
				...markArgs,
				uses: ['code-trail:code-trail/existing.md'],
			});
			await mark.connect('uses', 'target.md');
			assert.deepStrictEqual(mark.uses, [
				'code-trail:code-trail/existing.md',
				'code-trail:code-trail/target.md',
			]);
		});

		test('should work with usedBy field', async () => {
			const mark = new Mark(markArgs);
			await mark.connect('usedBy', 'caller.md');
			assert.deepStrictEqual(mark.usedBy, ['code-trail:code-trail/caller.md']);
		});
	});

	suite('Mark.find', () => {
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
			await new Mark({
				symbol: 'foo',
				symbolKind: 'function',
				...markArgs,
			}).save();
			const existing = await Mark.find('src/example.ts', 'foo');
			assert.ok(existing);
			assert.strictEqual(existing.file, 'src/example.ts');
			assert.strictEqual(existing.symbol, 'foo');
		});

		test('should return undefined when no matching mark exists', async () => {
			const existing = await Mark.find('src/example.ts', 'foo');
			assert.strictEqual(existing, undefined);
		});
	});
});
