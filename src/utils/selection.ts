import * as vscode from 'vscode';
import * as path from 'path';
import type { Symbol } from './symbol';

export interface SelectionInfo {
	filePath: string;
	fileName: string;
	startLine: number;
	endLine: number;
	selectedText: string;
	languageId: string;
	symbol?: string;
	symbolKind?: string;
}

export function buildSelectionInfo(
	document: vscode.TextDocument,
	range: vscode.Range,
	symbol?: Symbol,
): SelectionInfo {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}
	const absolutePath = document.uri.fsPath;
	const filePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);

	const fullRange = new vscode.Range(
		range.start.line,
		0,
		range.end.line,
		document.lineAt(range.end.line).text.length,
	);

	return {
		filePath,
		fileName: path.basename(absolutePath),
		startLine: range.start.line + 1,
		endLine: range.end.line + 1,
		selectedText: document.getText(fullRange),
		languageId: document.languageId,
		symbol: symbol?.name,
		symbolKind: symbol?.kind,
	};
}
