import * as vscode from 'vscode';
import { buildGraphData } from '../utils/graph';
import { log } from '../utils/logger';

export async function showGraph(context: vscode.ExtensionContext) {
	log('showGraph: started');
	const panel = vscode.window.createWebviewPanel(
		'codeTrailGraph',
		'Code Trail: Graph',
		vscode.ViewColumn.One,
		{ enableScripts: true, retainContextWhenHidden: true },
	);

	const graphData = await buildGraphData();

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

	panel.webview.html = getWebviewContent(visNetworkUri, graphData);

	panel.webview.onDidReceiveMessage(async (msg) => {
		if (msg.type === 'openMark') {
			const files = await vscode.workspace.findFiles(
				`code-trail/${msg.markId}`,
			);
			if (files.length > 0) {
				const doc = await vscode.workspace.openTextDocument(files[0]);
				await vscode.window.showTextDocument(doc, {
					viewColumn: vscode.ViewColumn.Two,
					preserveFocus: true,
				});
			}
		}
	});
}

function getWebviewContent(
	visNetworkUri: vscode.Uri,
	graphData: {
		nodes: { id: string; label: string; color: string }[];
		edges: { from: string; to: string }[];
	},
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
		const nodes = new vis.DataSet(${JSON.stringify(graphData.nodes)});
		const edges = new vis.DataSet(${JSON.stringify(graphData.edges)});
		const container = document.getElementById('graph');
		const network = new vis.Network(container, { nodes, edges }, {
			layout: {
				hierarchical: {
					direction: 'LR',
					sortMethod: 'directed',
					levelSeparation: 200,
					nodeSpacing: 100,
				},
			},
			edges: {
				arrows: { to: true },
				smooth: { type: 'cubicBezier' },
			},
			nodes: {
				shape: 'box',
				font: { size: 14 },
				margin: 10,
			},
			physics: false,
			interaction: {
				zoomView: true,
				dragView: true,
			},
		});
		network.on('click', (params) => {
			if (params.nodes.length > 0) {
				vscode.postMessage({ type: 'openMark', markId: params.nodes[0] });
			}
		});
	</script>
</body>
</html>`;
}
