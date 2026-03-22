import * as vscode from 'vscode';
import { exportSelection } from './commands/exportSelection';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('codeAtlas.exportSelection', exportSelection)
	);
}

export function deactivate() {}
