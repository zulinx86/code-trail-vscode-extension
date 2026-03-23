import * as vscode from 'vscode';
import { pinSelection } from './commands/pinSelection';
import { openLink } from './commands/openLink';
import { linkPin } from './commands/linkPin';
import { CodeAtlasLinkProvider } from './providers/linkProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'codeAtlas.pinSelection',
			pinSelection,
		),
		vscode.commands.registerCommand('codeAtlas.openLink', openLink),
		vscode.commands.registerCommand('codeAtlas.linkPin', linkPin),
		vscode.languages.registerDocumentLinkProvider(
			{ language: 'markdown' },
			new CodeAtlasLinkProvider(),
		),
	);
}

export function deactivate() {}
