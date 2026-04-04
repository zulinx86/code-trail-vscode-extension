import * as vscode from 'vscode';
import { log } from '../utils/logger';

interface LinkArgs {
	file: string;
	startLine?: number;
	endLine?: number;
}

export async function navigate(args: LinkArgs): Promise<void> {
	log(`navigate: ${JSON.stringify(args)}`);
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		log('navigate: no workspace folder found');
		vscode.window.showWarningMessage('No workspace folder found.');
		return;
	}

	const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.file);
	const doc = await vscode.workspace.openTextDocument(fileUri);
	const editor = await vscode.window.showTextDocument(doc);

	const line = args.startLine ? args.startLine - 1 : 0;
	const pos = new vscode.Position(line, 0);
	editor.selection = new vscode.Selection(pos, pos);
	editor.revealRange(
		new vscode.Range(pos, pos),
		vscode.TextEditorRevealType.InCenter,
	);
}
