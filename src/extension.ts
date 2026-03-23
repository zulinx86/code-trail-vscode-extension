import * as vscode from 'vscode';
import { bookmarkSelection } from './commands/bookmarkSelection';
import { openLink } from './commands/openLink';
import { linkBookmark } from './commands/linkBookmark';
import { CodeAtlasLinkProvider } from './providers/linkProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'codeAtlas.bookmarkSelection',
			bookmarkSelection,
		),
		vscode.commands.registerCommand('codeAtlas.openLink', openLink),
		vscode.commands.registerCommand('codeAtlas.linkBookmark', linkBookmark),
		vscode.languages.registerDocumentLinkProvider(
			{ language: 'markdown' },
			new CodeAtlasLinkProvider(),
		),
	);
}

export function deactivate() {}
