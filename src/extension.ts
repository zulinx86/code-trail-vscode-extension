import * as vscode from 'vscode';
import { markCode } from './commands/markCode';
import { navigate } from './commands/navigate';
import { linkMark } from './commands/linkMark';
import { CodeTrailNavigationProvider } from './providers/navigationProvider';
import { showGraph } from './commands/showGraph';
import { initLogger, log } from './utils/logger';

export function activate(context: vscode.ExtensionContext) {
	const channel = initLogger();
	context.subscriptions.push(channel);
	log('Code Trail activated');
	context.subscriptions.push(
		vscode.commands.registerCommand('codeTrail.markCode', markCode),
		vscode.commands.registerCommand('codeTrail.navigate', navigate),
		vscode.commands.registerCommand('codeTrail.linkMark', linkMark),
		vscode.commands.registerCommand('codeTrail.showGraph', () =>
			showGraph(context),
		),
		vscode.languages.registerDocumentLinkProvider(
			{ language: 'markdown' },
			new CodeTrailNavigationProvider(),
		),
	);
}

export function deactivate() {}
