import * as vscode from 'vscode';
import { getSelectionInfo } from '../utils/selection';
import { getSymbolAtPosition } from '../utils/symbol';
import { formatPin, generatePinFileName } from '../utils/pin';
import { saveFile } from '../utils/file';
import { getGitHubUrl } from '../utils/git';

export async function pinCode(): Promise<void> {
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

	const now = new Date();
	const info = getSelectionInfo(editor, range, symbolInfo?.name);
	const githubUrl = getGitHubUrl(info.filePath, info.startLine, info.endLine);
	const content = formatPin(info, now, githubUrl);
	const fileName = generatePinFileName(info, now);

	try {
		const fileUri = await saveFile(fileName, content);
		const doc = await vscode.workspace.openTextDocument(fileUri);
		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(`Saved: ${fileName}`);
	} catch (e) {
		vscode.window.showErrorMessage(`Failed to save pin: ${e}`);
	}
}
