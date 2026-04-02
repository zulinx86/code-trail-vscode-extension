import * as vscode from 'vscode';
import * as path from 'path';
import { log } from './logger';
import { Symbol } from './symbol';

export class Selection {
	readonly filePath: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly selectedText: string;
	readonly languageId: string;
	readonly symbol?: string;
	readonly symbolKind?: string;

	constructor(
		filePath: string,
		startLine: number,
		endLine: number,
		selectedText: string,
		languageId: string,
		symbol?: string,
		symbolKind?: string,
	) {
		this.filePath = filePath;
		this.startLine = startLine;
		this.endLine = endLine;
		this.selectedText = selectedText;
		this.languageId = languageId;
		this.symbol = symbol;
		this.symbolKind = symbolKind;
	}

	static async fromEditor(
		editor: vscode.TextEditor,
	): Promise<Selection | undefined> {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(
			editor.document.uri,
		);
		if (!workspaceFolder) {
			log('Selection.fromEditor: no workspace folder');
			return undefined;
		}

		const filePath = path.relative(
			workspaceFolder.uri.fsPath,
			editor.document.uri.fsPath,
		);
		log(`Selection.fromEditor: path=${filePath}`);

		const symbol = await Symbol.findSymbolAtPosition(
			editor.document.uri,
			editor.selection.start,
		);
		log(`Selection.fromEditor: symbol=${JSON.stringify(symbol)}`);

		const range = symbol ? symbol.range : editor.selection;
		log(
			`Selection.fromEditor: range=L${range.start.line + 1}-L${range.end.line + 1}`,
		);

		const fullRange = new vscode.Range(
			range.start.line,
			0,
			range.end.line,
			editor.document.lineAt(range.end.line).text.length,
		);

		return new Selection(
			filePath,
			range.start.line + 1,
			range.end.line + 1,
			editor.document.getText(fullRange),
			editor.document.languageId,
			symbol?.name,
			symbol?.kind,
		);
	}
}
