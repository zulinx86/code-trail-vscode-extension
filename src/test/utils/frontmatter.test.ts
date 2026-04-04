import * as assert from 'assert';
import * as vscode from 'vscode';
import { addLink } from '../../utils/frontmatter';

suite('frontmatter', () => {
	suite('addLink', () => {
		const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

		async function writeMark(
			name: string,
			content: string,
		): Promise<vscode.Uri> {
			const uri = vscode.Uri.joinPath(workspaceUri, name);
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
			return uri;
		}

		async function readMark(uri: vscode.Uri): Promise<string> {
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
			'link: code-trail:src/example.ts#L10-L24',
			'exportedAt: 2026-03-22T12:34:56Z',
			'---',
		].join('\n');

		test('should create field and add link when field does not exist', async () => {
			const uri = await writeMark('tmp-addlink-new.md', base);
			try {
				await addLink(uri, 'uses', 'code-trail/target.md');
				const content = await readMark(uri);
				assert.ok(
					content.includes('uses:\n  - code-trail:code-trail/target.md'),
				);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should append to existing field', async () => {
			const withUses = base.replace(
				'---\n',
				'uses:\n  - code-trail:code-trail/existing.md\n---\n',
			);
			const uri = await writeMark('tmp-addlink-append.md', withUses);
			try {
				await addLink(uri, 'uses', 'code-trail/target.md');
				const content = await readMark(uri);
				assert.ok(
					content.includes(
						'  - code-trail:code-trail/existing.md\n  - code-trail:code-trail/target.md',
					),
				);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should not add duplicate link', async () => {
			const uri = await writeMark('tmp-addlink-dup.md', base);
			try {
				await addLink(uri, 'uses', 'code-trail/target.md');
				await addLink(uri, 'uses', 'code-trail/target.md');
				const content = await readMark(uri);
				const count =
					content.split('code-trail:code-trail/target.md').length - 1;
				assert.strictEqual(count, 1);
			} finally {
				await deleteSilently(uri);
			}
		});

		test('should work with usedBy field', async () => {
			const uri = await writeMark('tmp-addlink-usedby.md', base);
			try {
				await addLink(uri, 'usedBy', 'code-trail/caller.md');
				const content = await readMark(uri);
				assert.ok(
					content.includes('usedBy:\n  - code-trail:code-trail/caller.md'),
				);
			} finally {
				await deleteSilently(uri);
			}
		});
	});
});
