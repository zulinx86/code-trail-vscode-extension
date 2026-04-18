import * as vscode from 'vscode';
import { markCode } from './commands/markCode';
import { addTitle } from './commands/addTitle';
import { navigate } from './commands/navigate';
import { connectMark } from './commands/connectMark';
import { createTrail } from './commands/createTrail';
import { switchTrail } from './commands/switchTrail';
import { CodeTrailLinkProvider } from './providers/linkProvider';
import { showGraph, initPanel } from './commands/showGraph';
import { initLogger, log } from './utils/logger';
import { workspaceFolder } from './config';
import { Trail } from './utils/trail';

export function activate(context: vscode.ExtensionContext) {
	const channel = initLogger();
	context.subscriptions.push(channel);

	if (!workspaceFolder) {
		log('Code Trail: no workspace folder found, skipping activation');
		return;
	}

	Trail.ensureSetup();

	log('Code Trail activated');
	vscode.window.registerWebviewPanelSerializer('codeTrailGraph', {
		deserializeWebviewPanel: (panel) => initPanel(context, panel),
	});
	context.subscriptions.push(
		vscode.commands.registerCommand('codeTrail.markCode', markCode),
		vscode.commands.registerCommand('codeTrail.addTitle', addTitle),
		vscode.commands.registerCommand('codeTrail.navigate', navigate),
		vscode.commands.registerCommand('codeTrail.connectMark', connectMark),
		vscode.commands.registerCommand('codeTrail.createTrail', createTrail),
		vscode.commands.registerCommand('codeTrail.switchTrail', switchTrail),
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
