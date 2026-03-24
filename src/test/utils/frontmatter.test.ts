import * as assert from 'assert';
import * as vscode from 'vscode';
import { addLink, parseFrontmatter } from '../../utils/frontmatter';

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
			assert.strictEqual(fm.link, 'code-atlas:src/example.ts#L10-L24');
			assert.strictEqual(fm.github, undefined);
			assert.strictEqual(fm.exportedAt, '2026-03-22T12:34:56Z');
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

	suite('addLink', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

		async function writePin(
			name: string,
			content: string,
		): Promise<vscode.Uri> {
			const uri = vscode.Uri.joinPath(workspaceUri, name);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
			return uri;
		}

		async function readPin(uri: vscode.Uri): Promise<string> {
			return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
				'utf-8',
			);
		}

		async function deleteSilently(uri: vscode.Uri) {
			try {
				await vscode.workspace.fs.delete(uri);
			} catch {}
		}

		const base = [
			'---',
			'file: src/example.ts',
			'range: L10-L24',
			'link: code-atlas:src/example.ts#L10-L24',
			'exportedAt: 2026-03-22T12:34:56Z',
			'---',
		].join('\n');

		test('should create field and add link when field does not exist', async () => {
			const uri = await writePin('tmp-addlink-new.md', base);
			try {
				await addLink(uri, 'uses', 'target.md');
				const content = await readPin(uri);
				assert.ok(content.includes('uses:\n  - target.md'));
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should append to existing field', async () => {
			const withUses = base.replace('---\n', 'uses:\n  - existing.md\n---\n');
			const uri = await writePin('tmp-addlink-append.md', withUses);
			try {
				await addLink(uri, 'uses', 'target.md');
				const content = await readPin(uri);
				assert.ok(content.includes('  - existing.md\n  - target.md'));
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should not add duplicate link', async () => {
			const uri = await writePin('tmp-addlink-dup.md', base);
			try {
				await addLink(uri, 'uses', 'target.md');
				await addLink(uri, 'uses', 'target.md');
				const content = await readPin(uri);
				const count = content.split('target.md').length - 1;
				assert.strictEqual(count, 1);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should work with usedBy field', async () => {
			const uri = await writePin('tmp-addlink-usedby.md', base);
			try {
				await addLink(uri, 'usedBy', 'caller.md');
				const content = await readPin(uri);
				assert.ok(content.includes('usedBy:\n  - caller.md'));
			} finally {
				await deleteSilently(uri);
			}
		});
	});
});
