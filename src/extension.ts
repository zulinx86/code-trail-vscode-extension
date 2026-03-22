import * as vscode from 'vscode';
import { bookmarkSelection } from './commands/bookmarkSelection';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('codeAtlas.bookmarkSelection', bookmarkSelection)
	);
}

export function deactivate() {}
