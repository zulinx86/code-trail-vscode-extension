import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Graph } from '../utils/graph';
import { OUTPUT_DIR, TRAILS_DIR, workspaceFolder } from '../config';
import { log } from '../utils/logger';
import { Mark } from '../utils/mark';
import { Trail } from '../utils/trail';

const panels: Set<vscode.WebviewPanel> = new Set();

function panelTitle(): string {
	const trail = Trail.active();
	return trail ? `Code Trail: Graph (${trail})` : 'Code Trail: Graph';
}

export async function showGraph(
	context: vscode.ExtensionContext,
): Promise<vscode.WebviewPanel> {
	log('showGraph: started');

	const panel = vscode.window.createWebviewPanel(
		'codeTrailGraph',
		panelTitle(),
		vscode.ViewColumn.Active,
		{ enableScripts: true, retainContextWhenHidden: true },
	);

	await initPanel(context, panel);
	return panel;
}

export async function initPanel(
	context: vscode.ExtensionContext,
	panel: vscode.WebviewPanel,
): Promise<void> {
	panels.add(panel);

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
	// Watch both the symlink path and the real trails directory,
	// since VS Code's file watcher may not follow symlinks.
	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceFolder!, `${OUTPUT_DIR}/*.md`),
	);
	const trailsWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceFolder!, `${TRAILS_DIR}/**/*.md`),
	);
	watcher.onDidCreate(() => refreshGraph(panel));
	watcher.onDidChange(() => refreshGraph(panel));
	watcher.onDidDelete(() => refreshGraph(panel));
	trailsWatcher.onDidCreate(() => refreshGraph(panel));
	trailsWatcher.onDidChange(() => refreshGraph(panel));
	trailsWatcher.onDidDelete(() => refreshGraph(panel));

	// Clean up watcher and panel reference when panel is closed.
	panel.onDidDispose(() => {
		watcher.dispose();
		trailsWatcher.dispose();
		panels.delete(panel);
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
		panel.title = panelTitle();
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
				preserveFocus: true,
			});
		}
	}
}
