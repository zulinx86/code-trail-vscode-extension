import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../utils/logger';
import { promptAndLink } from '../utils/link';
import { Mark } from '../utils/mark';

export async function linkMark(): Promise<void> {
	log('linkMark: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('linkMark: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const mark = Mark.fromText(editor.document.getText());
	if (!mark) {
		log('linkMark: current file is not a valid mark');
		vscode.window.showWarningMessage('Current file is not a valid mark.');
		return;
	}

	const currentMarkId = path.basename(editor.document.uri.fsPath);
	log(`linkMark: current mark ${currentMarkId}`);

	await promptAndLink(mark);
}
