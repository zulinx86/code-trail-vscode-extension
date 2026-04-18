import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { Connect } from '../utils/connect';
import { Mark } from '../utils/mark';
import { refreshAllPanels } from './showGraph';

export async function connectMark(): Promise<void> {
	log('connectMark: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('connerMark: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const mark = Mark.fromText(editor.document.getText());
	if (!mark) {
		log('connectMark: current file is not a valid mark');
		vscode.window.showWarningMessage('Current file is not a valid mark.');
		return;
	}
	log(`connectMark: current mark ${mark.id}`);

	await new Connect(mark).prompt();
	await refreshAllPanels();
}
