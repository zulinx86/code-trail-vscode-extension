import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeAtlasLinkProvider } from '../../providers/linkProvider';

suite('CodeAtlasLinkProvider', () => {
	const provider = new CodeAtlasLinkProvider();

	test('should detect code-atlas: link in frontmatter', async () => {
		const content = 'link: code-atlas:src/editor.ts#L10-L24';
		const doc = await vscode.workspace.openTextDocument({
			content,
			language: 'markdown',
		});

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 1);
		assert.ok(links[0].target?.toString().includes('codeAtlas.openLink'));
	});

	test('should detect multiple links', async () => {
		const content = [
			'link: code-atlas:a.ts#L1-L2',
			'some text',
			'link: code-atlas:b.ts#L3-L4',
		].join('\n');
		const doc = await vscode.workspace.openTextDocument({
			content,
			language: 'markdown',
		});

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 2);
	});

	test('should return no links for plain text', async () => {
		const content = 'no links here';
		const doc = await vscode.workspace.openTextDocument({
			content,
			language: 'markdown',
		});

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 0);
	});
});
