import * as vscode from 'vscode';
import { OUTPUT_DIR, workspaceFolder } from '../config';
import { log } from '../utils/logger';

export async function addTitle(): Promise<void> {
	log('addTitle: started');

	const title = await vscode.window.showInputBox({
		prompt: 'Enter title text',
		placeHolder: 'e.g. Initialization Flow',
	});
	if (!title) {
		return;
	}

	const now = new Date();
	const zeroPad = (n: number) => String(n).padStart(2, '0');
	const dtStr = `${now.getFullYear()}${zeroPad(now.getMonth() + 1)}${zeroPad(now.getDate())}-${zeroPad(now.getHours())}${zeroPad(now.getMinutes())}${zeroPad(now.getSeconds())}`;
	const safeName = title.replaceAll(' ', '-').replaceAll('.', '-');
	const fileName = `${dtStr}_${safeName}.md`;
	const timestamp = now.toISOString().replace(/\.\\d{3}Z$/, 'Z');

	const content = [
		'---',
		'file: (title)',
		'range: L0-L0',
		'link: code-trail:(title)',
		`exportedAt: ${timestamp}`,
		`symbol: ${title}`,
		'symbolKind: title',
		'---',
		'',
		'# Notes',
		'',
		'<!-- write notes here -->',
		'',
	].join('\n');

	const dirUri = vscode.Uri.joinPath(workspaceFolder!.uri, OUTPUT_DIR);
	await vscode.workspace.fs.createDirectory(dirUri);
	const fileUri = vscode.Uri.joinPath(dirUri, fileName);
	await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
	log(`addTitle: saved ${fileUri.fsPath}`);

	const doc = await vscode.workspace.openTextDocument(fileUri);
	await vscode.window.showTextDocument(doc);
	vscode.window.showInformationMessage(`Saved: ${fileName}`);
}
