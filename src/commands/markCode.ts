import * as vscode from 'vscode';
import { Selection } from '../utils/selection';
import { Mark } from '../utils/mark';
import { getGitHubUrl } from '../utils/git';
import { log } from '../utils/logger';
import { promptAndLink } from '../utils/link';

export async function markCode(): Promise<void> {
	log('markCode: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('markCode: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const selection = await Selection.fromEditor(editor);
	if (!selection) {
		log('markCode: failed to get selection info');
		vscode.window.showWarningMessage('markCode: Failed to get selection info.');
		return;
	}

	const { selectedText: _, ...logSelection } = selection;
	log(`markCode: selection=${JSON.stringify(logSelection)}`);

	if (selection.symbol) {
		const existing = await Mark.find(selection.file, selection.symbol);
		if (existing) {
			log(`markCode: duplicate mark found ${existing.id}`);
			vscode.window.showWarningMessage(`Mark already exists: ${existing.id}`);
			const doc = await vscode.workspace.openTextDocument(existing.uri!);
			await vscode.window.showTextDocument(doc);
			return;
		}
	}

	const github = getGitHubUrl(
		selection.file,
		selection.startLine,
		selection.endLine,
	);

	try {
		const mark = Mark.fromSelection(selection, new Date(), github);
		const uri = await mark.save();
		log(`markCode: saved ${uri.fsPath}`);
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(
			`Saved: ${uri.fsPath.split('/').pop()}`,
		);

		// Suggest links based on call hierarchy
		await promptAndLink(mark);
	} catch (e) {
		log(`markCode: failed to save mark: ${e}`);
		vscode.window.showErrorMessage(`Failed to save mark: ${e}`);
	}
}
