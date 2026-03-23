import * as vscode from 'vscode';
import * as path from 'path';

export interface SelectionInfo {
	filePath: string;
	fileName: string;
	startLine: number;
	endLine: number;
	selectedText: string;
	languageId: string;
	symbol?: string;
}

export function getSelectionInfo(editor: vscode.TextEditor, range: vscode.Range, symbolName?: string): SelectionInfo {
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
		symbol: symbolName,
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

export interface SymbolInfo {
	range: vscode.Range;
	name: string;
}

function findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position, prefix = ''): SymbolInfo | undefined {
	for (const symbol of symbols) {
		if (!symbol.range.contains(position)) {
			continue;
		}

		// Symbol found at position
		const qualifiedName = prefix ? `${prefix}.${symbol.name}` : symbol.name;

		// Search children first to get the innermost.
		const child = findSymbolAtPosition(symbol.children, position, qualifiedName);
		if (child) {
			return child;
		}

		// The innermost one reaches here.
		if (BOOKMARKABLE_KINDS.includes(symbol.kind)) {
			return { range: symbol.range, name: qualifiedName };
		}
	}
	// No children or no symbol found at position
	return undefined;
}

export async function getSymbolForRange(uri: vscode.Uri, range: vscode.Range): Promise<SymbolInfo | undefined> {
	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		'vscode.executeDocumentSymbolProvider',
		uri,
	);
	if (!symbols) {
		return undefined;
	}
	return findSymbolAtPosition(symbols, range.start);
}
