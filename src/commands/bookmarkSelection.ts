import * as vscode from 'vscode';
import { getSelectionInfo, getFunctionAtCursor } from '../utils/editor';
import { formatRecord, generateFileName } from '../utils/format';
import { saveRecord } from '../utils/file';
import { getGitHubUrl } from '../utils/git';

export async function bookmarkSelection(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showWarningMessage('No workspace folder found.');
		return;
	}

	let range: vscode.Range;
	if (!editor.selection.isEmpty) {
		range = editor.selection;
	} else {
		const funcRange = await getFunctionAtCursor(editor);
		if (!funcRange) {
			vscode.window.showWarningMessage('No selection or function found at cursor.');
			return;
		}
		range = funcRange;
	}

	const now = new Date();
	const info = getSelectionInfo(editor, range);
	const githubUrl = getGitHubUrl(info.filePath, info.startLine, info.endLine);
	const content = formatRecord(info, now, githubUrl);
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
