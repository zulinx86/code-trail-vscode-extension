import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
	buildGraphData,
	type GraphData,
	PADDING,
	CODE_FONT_SIZE,
	CODE_LINE_HEIGHT,
	CODE_CHAR_WIDTH,
	HEADER_FONT_SIZE,
	HEADER_HEIGHT,
	HEADER_CHAR_WIDTH,
	EXT_LABEL_FONT_SIZE,
	EXT_LABEL_GAP,
} from '../utils/graph';
import { OUTPUT_DIR } from '../config';
import { log } from '../utils/logger';

export async function showGraph(
	context: vscode.ExtensionContext,
): Promise<vscode.WebviewPanel> {
	log('showGraph: started');
	const panel = vscode.window.createWebviewPanel(
		'codeTrailGraph',
		'Code Trail: Graph',
		vscode.ViewColumn.One,
		{ enableScripts: true, retainContextWhenHidden: true },
	);

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

	const graphData = await buildGraphData();
	panel.webview.html = getWebviewContent(context, visNetworkUri, graphData);

	// Watch for mark file changes to auto-refresh the graph.
	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(
			vscode.workspace.workspaceFolders![0],
			`${OUTPUT_DIR}/*.md`,
		),
	);
	watcher.onDidCreate(() => refreshGraph(panel));
	watcher.onDidChange(() => refreshGraph(panel));
	watcher.onDidDelete(() => refreshGraph(panel));

	// Clean up watcher when panel is closed.
	panel.onDidDispose(() => watcher.dispose());

	// Hook function to handle a message from webview.
	panel.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));

	return panel;
}

// Escape '<' and '>' to Unicode so that strings like "</script>" in code
// snippets don't break the HTML <script> tag.
function escapeForScriptTag(s: string): string {
	return s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

// Build webview content
function getWebviewContent(
	context: vscode.ExtensionContext,
	visNetworkUri: vscode.Uri,
	graphData: GraphData,
): string {
	// * 1st JSON.stringify: convert graphData object to a JSON string.
	// * escapeForScript: replace '<' and '>' with Unicode for safe HTML
	//   embedding.
	// * 2nd JSON.stringify: wrap the result as a quoted JS string literal
	//   so it can be embedded in the HTML template as JSON.parse(...).
	const jsonData = JSON.stringify(
		escapeForScriptTag(JSON.stringify(graphData)),
	);

	const constants: Record<string, number> = {
		PADDING,
		CODE_FONT_SIZE,
		CODE_LINE_HEIGHT,
		CODE_CHAR_WIDTH,
		HEADER_FONT_SIZE,
		HEADER_HEIGHT,
		HEADER_CHAR_WIDTH,
		EXT_LABEL_FONT_SIZE,
		EXT_LABEL_GAP,
	};

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
	for (const [key, value] of Object.entries(constants)) {
		result = result.replace(`{{${key}}}`, String(value));
	}
	return result;
}

// Hook function to refresh the graph
export async function refreshGraph(panel: vscode.WebviewPanel): Promise<void> {
	const data = await buildGraphData();
	log(`refreshGraph: ${data.nodes.length} nodes, ${data.edges.length} edges`);
	try {
		panel.webview.postMessage({
			type: 'updateGraph',
			nodes: data.nodes,
			edges: data.edges,
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
