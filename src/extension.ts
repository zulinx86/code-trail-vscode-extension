import * as vscode from 'vscode';
import { markCode } from './commands/markCode';
import { openLink } from './commands/openLink';
import { linkMark } from './commands/linkMark';
import { CodeTrailLinkProvider } from './providers/linkProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('codeTrail.markCode', markCode),
		vscode.commands.registerCommand('codeTrail.openLink', openLink),
		vscode.commands.registerCommand('codeTrail.linkMark', linkMark),
		vscode.languages.registerDocumentLinkProvider(
			{ language: 'markdown' },
			new CodeTrailLinkProvider(),
		),
	);
}

export function deactivate() {}
