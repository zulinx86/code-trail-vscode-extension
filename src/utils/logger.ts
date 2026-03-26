import * as vscode from 'vscode';

let channel: vscode.OutputChannel;

export function initLogger(): vscode.OutputChannel {
	channel = vscode.window.createOutputChannel('Code Trail');
	return channel;
}

export function log(message: string): void {
	if (!channel) {
		return;
	}
	const timestamp = new Date().toISOString();
	channel.appendLine(`[${timestamp}] ${message}`);
}
