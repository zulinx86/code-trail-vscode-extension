import * as vscode from 'vscode';
import * as path from 'path';

export interface SelectionInfo {
	filePath: string;
	fileName: string;
	startLine: number;
	endLine: number;
	selectedText: string;
	languageId: string;
}

export function getSelectionInfo(editor: vscode.TextEditor): SelectionInfo {
	const document = editor.document;
	const selection = editor.selection;
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}
	const absolutePath = document.uri.fsPath;
	const filePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);

	return {
		filePath,
		fileName: path.basename(absolutePath),
		startLine: selection.start.line + 1,
		endLine: selection.end.line + 1,
		selectedText: document.getText(selection),
		languageId: document.languageId,
	};
}
