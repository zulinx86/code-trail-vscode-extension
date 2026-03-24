import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeTrailLinkProvider } from '../../providers/linkProvider';

suite('CodeTrailLinkProvider', () => {
	const provider = new CodeTrailLinkProvider();

	test('should detect code-trail: link in frontmatter', async () => {
		const content = 'link: code-trail:src/editor.ts#L10-L24';
		const doc = await vscode.workspace.openTextDocument({
			content,
			language: 'markdown',
		});

		const links = provider.provideDocumentLinks(doc);
		assert.strictEqual(links.length, 1);
		assert.ok(links[0].target?.toString().includes('codeTrail.openLink'));
	});

	test('should detect multiple links', async () => {
		const content = [
			'link: code-trail:a.ts#L1-L2',
			'some text',
			'link: code-trail:b.ts#L3-L4',
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
