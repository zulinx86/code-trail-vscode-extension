import * as vscode from 'vscode';
import { markCode } from './commands/markCode';
import { openLink } from './commands/openLink';
import { linkMark } from './commands/linkMark';
import { CodeTrailLinkProvider } from './providers/linkProvider';
import { showGraph } from './commands/showGraph';
import { initLogger, log } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
	const channel = initLogger();
	context.subscriptions.push(channel);
	log('Code Trail activated');
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
