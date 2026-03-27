import * as vscode from 'vscode';
import * as path from 'path';
import { parseFrontmatter } from '../utils/frontmatter';
import { log } from '../utils/logger';
import { promptAndLink } from '../utils/link';

export async function linkMark(): Promise<void> {
	log('linkMark: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('linkMark: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const currentFm = parseFrontmatter(editor.document.getText());
	if (!currentFm) {
		log('linkMark: current file is not a valid mark');
		vscode.window.showWarningMessage('Current file is not a valid mark.');
		return;
	}

	const currentMarkId = path.basename(editor.document.uri.fsPath);
	log(`linkMark: current mark ${currentMarkId}`);

	await promptAndLink(editor.document.uri, currentFm);
}
