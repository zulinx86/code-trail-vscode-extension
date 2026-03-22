import * as vscode from 'vscode';
import { getSelectionInfo } from '../utils/editor';
import { formatRecord, generateFileName } from '../utils/format';
import { saveRecord } from '../utils/file';

export async function exportSelection(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	if (editor.selection.isEmpty) {
		vscode.window.showWarningMessage('No text selected.');
		return;
	}

	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showWarningMessage('No workspace folder found.');
		return;
	}

	const now = new Date();
	const info = getSelectionInfo(editor);
	const content = formatRecord(info, now);
	const fileName = generateFileName(info, now);

	try {
		const fileUri = await saveRecord(fileName, content);
		const doc = await vscode.workspace.openTextDocument(fileUri);
		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(`Saved: ${fileName}`);
	} catch (e) {
		vscode.window.showErrorMessage(`Failed to save record: ${e}`);
	}
}
