import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Graph } from '../utils/graph';
import { OUTPUT_DIR, workspaceFolder } from '../config';
import { log } from '../utils/logger';
import { Mark } from '../utils/mark';

let existingPanel: vscode.WebviewPanel | undefined;

export async function showGraph(
	context: vscode.ExtensionContext,
): Promise<vscode.WebviewPanel> {
	log('showGraph: started');

	// If an existing panel is still alive, reveal it and refresh its content.
	if (existingPanel) {
		existingPanel.reveal();
		await refreshGraph(existingPanel);
		return existingPanel;
	}

	const panel = vscode.window.createWebviewPanel(
		'codeTrailGraph',
		'Code Trail: Graph',
		vscode.ViewColumn.One,
		{ enableScripts: true, retainContextWhenHidden: true },
	);

	await initPanel(context, panel);
	return panel;
}

export async function initPanel(
	context: vscode.ExtensionContext,
	panel: vscode.WebviewPanel,
): Promise<void> {
	existingPanel = panel;

	const visNetworkUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(
			context.extensionUri,
			'node_modules',
			'vis-network',
			'standalone',
			'umd',
			'vis-network.min.js',
		),
	);

	const marks = await Mark.getAll();
	const graph = Graph.fromMarks(marks);
	panel.webview.html = getWebviewContent(context, visNetworkUri, graph);

	// Watch for mark file changes to auto-refresh the graph.
	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceFolder!, `${OUTPUT_DIR}/*.md`),
	);
	watcher.onDidCreate(() => refreshGraph(panel));
	watcher.onDidChange(() => refreshGraph(panel));
	watcher.onDidDelete(() => refreshGraph(panel));

	// Clean up watcher and panel reference when panel is closed.
	panel.onDidDispose(() => {
		watcher.dispose();
		existingPanel = undefined;
	});

	// Hook function to handle a message from webview.
	panel.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));
}

// Build webview content
function getWebviewContent(
	context: vscode.ExtensionContext,
	visNetworkUri: vscode.Uri,
	graph: Graph,
): string {
	const jsonData = graph.stringify();

	const templatePath = path.join(
		context.extensionPath,
		'dist',
		'webview',
		'graph.html',
	);
	const template = fs.readFileSync(templatePath, 'utf-8');

	let result = template
		.replace('{{VIS_NETWORK_URI}}', String(visNetworkUri))
		.replace('{{GRAPH_DATA}}', jsonData);

	const fonts = graph.config.fonts.dump();
	for (const [key, value] of Object.entries(fonts)) {
		result = result.replace(`{{${key}}}`, String(value));
	}

	return result;
}

// Hook function to refresh the graph
export async function refreshGraph(panel: vscode.WebviewPanel): Promise<void> {
	const marks = await Mark.getAll();
	const graph = Graph.fromMarks(marks);
	log(
		`refreshGraph: ${graph.data.nodes.length} nodes, ${graph.data.edges.length} edges`,
	);
	try {
		panel.webview.postMessage({
			type: 'updateGraph',
			nodes: graph.data.nodes,
			edges: graph.data.edges,
		});
	} catch {
		// Panel may have been disposed
	}
}

// Hook function to handle a message sent from graph.html via
// vscodeApi.postMessage()
export async function handleWebviewMessage(msg: any): Promise<void> {
	if (msg.type === 'openMark') {
		const files = await vscode.workspace.findFiles(`code-trail/${msg.markId}`);
		if (files.length > 0) {
			const doc = await vscode.workspace.openTextDocument(files[0]);
			await vscode.window.showTextDocument(doc, {
				viewColumn: vscode.ViewColumn.Two,
				preserveFocus: true,
			});
		}
	}
}
