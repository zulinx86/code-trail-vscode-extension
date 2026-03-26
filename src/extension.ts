import * as vscode from 'vscode';
import { markCode } from './commands/markCode';
import { openLink } from './commands/openLink';
import { linkMark } from './commands/linkMark';
import { CodeTrailLinkProvider } from './providers/linkProvider';
import { showGraph } from './commands/showGraph';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('codeTrail.markCode', markCode),
		vscode.commands.registerCommand('codeTrail.openLink', openLink),
		vscode.commands.registerCommand('codeTrail.linkMark', linkMark),
		vscode.commands.registerCommand('codeTrail.showGraph', () =>
			showGraph(context),
		),
		vscode.languages.registerDocumentLinkProvider(
			{ language: 'markdown' },
			new CodeTrailLinkProvider(),
		),
	);
}

export function deactivate() {}
