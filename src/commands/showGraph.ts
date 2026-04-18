import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Graph } from '../utils/graph';
import { OUTPUT_DIR, TRAILS_DIR, workspaceFolder } from '../config';
import { log } from '../utils/logger';
import { Mark } from '../utils/mark';
import { Trail } from '../utils/trail';

/** State persisted by the webview via vscodeApi.setState(). */
export interface WebviewState {
	trailName?: string;
}

interface PanelState {
	panel: vscode.WebviewPanel;
	trailDir: string | undefined;
}

const panelStates: Set<PanelState> = new Set();

export async function showGraph(
	context: vscode.ExtensionContext,
): Promise<vscode.WebviewPanel> {
	log('showGraph: started');

	const trailName = Trail.active();
	const panel = vscode.window.createWebviewPanel(
		'codeTrailGraph',
		trailName ? `Code Trail: Graph (${trailName})` : 'Code Trail: Graph',
		vscode.ViewColumn.Active,
		{ enableScripts: true, retainContextWhenHidden: true },
	);

	await initPanel(context, panel, trailName);
	return panel;
}

/**
 * Initialize (or restore) a graph panel.
 * @param trailName - the trail this panel is bound to. On fresh open,
 *   this is the currently active trail. On deserialization, it comes
 *   from the webview state saved before reload.
 */
export async function initPanel(
	context: vscode.ExtensionContext,
	panel: vscode.WebviewPanel,
	trailName?: string,
): Promise<void> {
	const trailDir = trailName ? `${TRAILS_DIR}/${trailName}` : undefined;
	const state: PanelState = { panel, trailDir };
	panelStates.add(state);

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

	const marks = await Mark.getAll(trailDir);
	const graph = Graph.fromMarks(marks);
	panel.webview.html = getWebviewContent(
		context,
		visNetworkUri,
		graph,
		trailName,
	);

	// Watch for mark file changes to auto-refresh the graph.
	const outputPath = path.join(workspaceFolder!.uri.fsPath, OUTPUT_DIR);
	const symlinkWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(workspaceFolder!, `${OUTPUT_DIR}/*.md`),
	);
	symlinkWatcher.onDidCreate(() => refreshPanel(state));
	symlinkWatcher.onDidChange(() => refreshPanel(state));
	symlinkWatcher.onDidDelete(() => refreshPanel(state));

	let realWatcher: vscode.FileSystemWatcher | undefined;
	try {
		const realPath = fs.realpathSync(outputPath);
		if (realPath !== outputPath) {
			realWatcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(vscode.Uri.file(realPath), '*.md'),
			);
			realWatcher.onDidCreate(() => refreshPanel(state));
			realWatcher.onDidChange(() => refreshPanel(state));
			realWatcher.onDidDelete(() => refreshPanel(state));
		}
	} catch {
		// Symlink target doesn't exist yet
	}

	panel.onDidDispose(() => {
		symlinkWatcher.dispose();
		realWatcher?.dispose();
		panelStates.delete(state);
	});

	// Hook function to handle a message from webview.
	panel.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));
}

// Build webview content
function getWebviewContent(
	context: vscode.ExtensionContext,
	visNetworkUri: vscode.Uri,
	graph: Graph,
	trailName?: string,
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

	// Inject trail name into webview state so it survives window reload.
	if (trailName) {
		const webviewState: WebviewState = { trailName };
		result = result.replace(
			'</body>',
			`<script>
				if (typeof vscodeApi !== 'undefined' && vscodeApi) {
					vscodeApi.setState(${JSON.stringify(webviewState)});
				}
			</script></body>`,
		);
	}

	return result;
}

async function refreshPanel(state: PanelState): Promise<void> {
	const marks = await Mark.getAll(state.trailDir);
	const graph = Graph.fromMarks(marks);
	log(
		`refreshGraph: ${graph.data.nodes.length} nodes, ${graph.data.edges.length} edges`,
	);
	try {
		state.panel.webview.postMessage({
			type: 'updateGraph',
			nodes: graph.data.nodes,
			edges: graph.data.edges,
		});
	} catch {
		// Panel may have been disposed
	}
}

/** Refresh all open graph panels. */
export async function refreshAllPanels(): Promise<void> {
	for (const state of panelStates) {
		await refreshPanel(state);
	}
}

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
