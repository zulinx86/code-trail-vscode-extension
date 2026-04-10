import * as vscode from 'vscode';
import { Selection } from '../utils/selection';
import { Mark } from '../utils/mark';
import { getGitHubUrl } from '../utils/git';
import { log } from '../utils/logger';
import { Connect } from '../utils/connect';

export async function markCode(): Promise<void> {
	log('markCode: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('markCode: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	let selection = await Selection.fromEditor(editor);
	if (!selection) {
		log('markCode: failed to get selection info');
		vscode.window.showWarningMessage('markCode: Failed to get selection info.');
		return;
	}

	const { selectedText: _, ...logSelection } = selection;
	log(`markCode: selection=${JSON.stringify(logSelection)}`);

	if (!selection.symbol) {
		const input = await vscode.window.showInputBox({
			prompt: 'No symbol found at cursor. Enter a symbol name for this mark:',
			placeHolder: 'e.g. myFunction',
		});
		if (!input) {
			log('markCode: symbol input dismissed');
			return;
		}
		selection = new Selection({ ...selection, symbol: input });
	}

	const existing = await Mark.find(selection.file, selection.symbol!);
	if (existing) {
		log(`markCode: duplicate mark found ${existing.id}`);
		const choice = await vscode.window.showQuickPick(
			[
				{
					label: '$(file) Open Existing',
					description: existing.id,
					value: 'open' as const,
				},
				{
					label: '$(add) Create New',
					description: 'Create a new mark for this symbol',
					value: 'create' as const,
				},
			],
			{ placeHolder: `Mark already exists: ${existing.id}` },
		);
		switch (choice?.value) {
			case 'open': {
				const doc = await vscode.workspace.openTextDocument(existing.uri!);
				await vscode.window.showTextDocument(doc, { preview: true });
				return;
			}
			case 'create':
				log('markCode: user chose to create new mark');
				break;
			default:
				log('markCode: duplicate prompt dismissed');
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

		// Suggest connections based on call hierarchy
		await new Connect(mark).prompt();
	} catch (e) {
		log(`markCode: failed to save mark: ${e}`);
		vscode.window.showErrorMessage(`Failed to save mark: ${e}`);
	}
}
