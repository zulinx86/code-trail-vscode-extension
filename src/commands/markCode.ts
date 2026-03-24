import * as vscode from 'vscode';
import { buildSelectionInfo } from '../utils/selection';
import { getSymbolAtPosition } from '../utils/symbol';
import { saveMark } from '../utils/mark';
import { getGitHubUrl } from '../utils/git';

export async function markCode(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showWarningMessage('No workspace folder found.');
		return;
	}

	const symbolInfo = await getSymbolAtPosition(
		editor.document.uri,
		editor.selection.start,
	);

	let range: vscode.Range;
	if (symbolInfo) {
		range = symbolInfo.range;
	} else if (!editor.selection.isEmpty) {
		range = editor.selection;
	} else {
		vscode.window.showWarningMessage('No selection or symbol found at cursor.');
		return;
	}

	const info = buildSelectionInfo(editor.document, range, symbolInfo?.name);
	const githubUrl = getGitHubUrl(info.filePath, info.startLine, info.endLine);

	try {
		const fileUri = await saveMark(info, new Date(), githubUrl);
		const doc = await vscode.workspace.openTextDocument(fileUri);
		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(
			`Saved: ${fileUri.fsPath.split('/').pop()}`,
		);
	} catch (e) {
		vscode.window.showErrorMessage(`Failed to save mark: ${e}`);
	}
}
