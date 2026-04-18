import * as vscode from 'vscode';
import { Mark } from '../utils/mark';
import { log } from '../utils/logger';
import { refreshAllPanels } from './showGraph';

export async function addTitle(): Promise<void> {
	log('addTitle: started');

	const title = await vscode.window.showInputBox({
		prompt: 'Enter title text',
		placeHolder: 'e.g. Initialization Flow',
	});
	if (!title) {
		return;
	}

	const mark = Mark.fromTitle(title);
	const uri = await mark.save();
	log(`addTitle: saved ${uri.fsPath}`);

	const doc = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(doc);
	vscode.window.showInformationMessage(`Saved: ${mark.id}`);
	await refreshAllPanels();
}
