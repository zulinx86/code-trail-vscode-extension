import * as vscode from 'vscode';
import * as path from 'path';
import { log } from './logger';
import { Symbol } from './symbol';

export interface SelectionParams {
	file: string;
	startLine: number;
	endLine: number;
	selectedText: string;
	symbol?: string;
	symbolKind?: string;
}

export class Selection {
	readonly file: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly selectedText: string;
	readonly symbol?: string;
	readonly symbolKind?: string;

	constructor(params: SelectionParams) {
		this.file = params.file;
		this.startLine = params.startLine;
		this.endLine = params.endLine;
		this.selectedText = params.selectedText;
		this.symbol = params.symbol;
		this.symbolKind = params.symbolKind;
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

		const file = path.relative(
			workspaceFolder.uri.fsPath,
			editor.document.uri.fsPath,
		);
		log(`Selection.fromEditor: path=${file}`);

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

		return new Selection({
			file: file,
			startLine: range.start.line + 1,
			endLine: range.end.line + 1,
			selectedText: editor.document.getText(fullRange),
			symbol: symbol?.name,
			symbolKind: symbol?.kind,
		});
	}
}
