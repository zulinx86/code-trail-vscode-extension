import * as vscode from 'vscode';
import { buildGraphData, type GraphData } from '../utils/graph';
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
	panel.webview.html = getWebviewContent(visNetworkUri, graphData);

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

	// Open mark file in editor when a node is clicked.
	panel.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));

	return panel;
}

function getWebviewContent(
	visNetworkUri: vscode.Uri,
	graphData: GraphData,
): string {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { margin: 0; overflow: hidden; }
		#graph { width: 100vw; height: 100vh; }
	</style>
</head>
<body>
	<div id="graph"></div>
	<script src="${visNetworkUri}"></script>
	<script>
		const vscode = acquireVsCodeApi();
		const nodes = new vis.DataSet(${JSON.stringify(graphData.nodes)}.map(n => ({
			...n, x: n.x, y: n.y
		})));
		const edges = new vis.DataSet(${JSON.stringify(graphData.edges)});
		const container = document.getElementById('graph');
		const network = new vis.Network(container, { nodes, edges }, {
			edges: {
				arrows: { to: true },
				smooth: { type: 'cubicBezier' },
			},
			nodes: {
				shape: 'box',
				font: { size: 14, face: 'monospace' },
				margin: 10,
			},
			physics: false,
			interaction: {
				zoomView: true,
				dragView: true,
				dragNodes: true,
			},
		});
		// Notify extension to open the mark file.
		network.on('click', (params) => {
			if (params.nodes.length > 0) {
				vscode.postMessage({ type: 'openMark', markId: params.nodes[0] });
			}
		});
		// Listen for updateGraph messages from extension to refresh data.
		// clear() + add() preserves zoom/pan position.
		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (msg.type === 'updateGraph') {
				nodes.clear();
				nodes.add(msg.nodes);
				edges.clear();
				edges.add(msg.edges);
			}
		});
	</script>
</body>
</html>`;
}

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
