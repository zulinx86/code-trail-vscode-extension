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

export function getSelectionInfo(editor: vscode.TextEditor, range: vscode.Range): SelectionInfo {
	const document = editor.document;
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}
	const absolutePath = document.uri.fsPath;
	const filePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);

	const fullRange = new vscode.Range(
		range.start.line, 0,
		range.end.line, document.lineAt(range.end.line).text.length,
	);

	return {
		filePath,
		fileName: path.basename(absolutePath),
		startLine: range.start.line + 1,
		endLine: range.end.line + 1,
		selectedText: document.getText(fullRange),
		languageId: document.languageId,
	};
}

const BOOKMARKABLE_KINDS = [
	vscode.SymbolKind.Function,
	vscode.SymbolKind.Method,
	vscode.SymbolKind.Constructor,
	vscode.SymbolKind.Class,
	vscode.SymbolKind.Struct,
	vscode.SymbolKind.Enum,
	vscode.SymbolKind.Interface,
];

function findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | undefined {
	for (const symbol of symbols) {
		if (!symbol.range.contains(position)) {
			continue;
		}
		// check children first for the most specific (innermost) match
		const child = findSymbolAtPosition(symbol.children, position);
		if (child) {
			return child;
		}
		if (BOOKMARKABLE_KINDS.includes(symbol.kind)) {
			return symbol;
		}
	}
	return undefined;
}

export async function getSymbolAtCursor(editor: vscode.TextEditor): Promise<vscode.Range | undefined> {
	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		'vscode.executeDocumentSymbolProvider',
		editor.document.uri,
	);
	if (!symbols) {
		return undefined;
	}
	const func = findSymbolAtPosition(symbols, editor.selection.active);
	return func?.range;
}
