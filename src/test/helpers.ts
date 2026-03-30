import * as vscode from 'vscode';
import * as path from 'path';

const FIXTURES_DIR = path.join(
	__dirname,
	'..',
	'..',
	'src',
	'test',
	'fixtures',
);

export function fixtureUri(name: string): vscode.Uri {
	return vscode.Uri.file(path.join(FIXTURES_DIR, name));
}

export async function openFixture(name: string): Promise<vscode.TextDocument> {
	const uri = fixtureUri(name);
	const doc = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(doc);
	return doc;
}

export async function waitForSymbols(
	uri: vscode.Uri,
	timeout = 3000,
): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const symbols = await vscode.commands.executeCommand<
			vscode.DocumentSymbol[]
		>('vscode.executeDocumentSymbolProvider', uri);
		if (symbols?.length) {
			return;
		}
		await new Promise((r) => setTimeout(r, 100));
	}
}
