import * as vscode from 'vscode';
import { Selection } from '../utils/selection';
import { Symbol } from '../utils/symbol';
import { saveMark, findExistingMark } from '../utils/mark';
import { getGitHubUrl } from '../utils/git';
import { parseFrontmatter } from '../utils/frontmatter';
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
		const existing = await findExistingMark(selection.file, selection.symbol);
		if (existing) {
			log(`markCode: duplicate mark found ${existing.markId}`);
			vscode.window.showWarningMessage(
				`Mark already exists: ${existing.markId}`,
			);
			const doc = await vscode.workspace.openTextDocument(existing.uri);
			await vscode.window.showTextDocument(doc);
			return;
		}
	}

	const githubUrl = getGitHubUrl(
		selection.file,
		selection.startLine,
		selection.endLine,
	);

	try {
		const fileUri = await saveMark(selection, new Date(), githubUrl);
		log(`markCode: saved ${fileUri.fsPath}`);
		const doc = await vscode.workspace.openTextDocument(fileUri);
		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(
			`Saved: ${fileUri.fsPath.split('/').pop()}`,
		);

		// Suggest links based on call hierarchy
		const content = (await vscode.workspace.fs.readFile(fileUri)).toString();
		const fm = parseFrontmatter(content);
		if (fm) {
			await promptAndLink(fileUri, fm);
		}
	} catch (e) {
		log(`markCode: failed to save mark: ${e}`);
		vscode.window.showErrorMessage(`Failed to save mark: ${e}`);
	}
}
