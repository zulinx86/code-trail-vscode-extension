import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { getMarks } from './mark';
import type { Frontmatter } from './frontmatter';
import { log } from './logger';
import dagre from '@dagrejs/dagre';

// Node layout constants (shared with src/webview/graph.html via template
// placeholders)
export const FONT_SIZE = 18;
export const HEADER_FONT_SIZE = 20;
export const PADDING = 12;
// 1.4x font size for comfortable line spacing in code display.
export const LINE_HEIGHT = FONT_SIZE * 1.4;
export const HEADER_HEIGHT = HEADER_FONT_SIZE + PADDING * 2;
// Approximate character width for monospace fonts (~0.62 of font size).
export const CHAR_WIDTH = FONT_SIZE * 0.62;
export const HEADER_CHAR_WIDTH = HEADER_FONT_SIZE * 0.62;
export const EXT_LABEL_FONT_SIZE = 14;
export const EXT_LABEL_GAP = 4;

export interface GraphNode {
	id: string;
	label: string;
	code: string;
	file: string;
	color: string;
	width: number;
	height: number;
	x: number;
	y: number;
}

export interface GraphEdge {
	from: string;
	to: string;
}

export interface GraphData {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

const DEFAULT_SYMBOL_COLORS: Record<string, string> = {
	function: '#A8D8F0',
	method: '#A8D8F0',
	constructor: '#A8D8F0',
	class: '#A8E6CF',
	struct: '#A8E6CF',
	enum: '#FFE0B2',
	interface: '#D7BDE2',
	const: '#F5B7B1',
};
const DEFAULT_COLOR = '#DBDBDB';

interface GraphConfig {
	tabSize: number;
	tabSizeByLanguage: Record<string, number>;
	symbolColors: Record<string, string>;
}

function loadConfig(): GraphConfig {
	const config = vscode.workspace.getConfiguration('codeTrail');
	return {
		tabSize: config.get<number>('tabSize', 4),
		tabSizeByLanguage: config.get<Record<string, number>>('tabSizeByLanguage', {}),
		symbolColors: config.get<Record<string, string>>('symbolColors', {}),
	};
}

export function nodeLabel(fm: Frontmatter): string {
	if (!fm.symbol) {
		return `${fm.file}#L${fm.startLine}-L${fm.endLine}`;
	}
	if (
		fm.symbolKind === 'function' ||
		fm.symbolKind === 'method' ||
		fm.symbolKind === 'constructor'
	) {
		return `${fm.symbol}()`;
	}
	if (
		fm.symbolKind === 'enum' ||
		fm.symbolKind === 'struct' ||
		fm.symbolKind === 'class' ||
		fm.symbolKind === 'interface' ||
		fm.symbolKind === 'const'
	) {
		return `${fm.symbolKind} ${fm.symbol}`;
	}
	return fm.symbol;
}

export function nodeColor(cfg: GraphConfig, symbolKind?: string): string {
	const kind = symbolKind ?? '';
	return cfg.symbolColors[kind] ?? DEFAULT_SYMBOL_COLORS[kind] ?? DEFAULT_COLOR;
}

export function measureNodeSize(
	label: string,
	code: string,
): { width: number; height: number } {
	const headerWidth = label.length * HEADER_CHAR_WIDTH + PADDING * 2;
	if (!code) {
		return { width: Math.max(headerWidth, 60), height: HEADER_HEIGHT };
	}
	const lines = code.split('\n');
	let maxLineLen = 0;
	for (const line of lines) {
		if (line.length > maxLineLen) {
			maxLineLen = line.length;
		}
	}
	const codeWidth = maxLineLen * CHAR_WIDTH + PADDING * 2;
	const codeHeight = lines.length * LINE_HEIGHT + PADDING * 2;
	return {
		width: Math.max(headerWidth, codeWidth, 60),
		height: HEADER_HEIGHT + codeHeight,
	};
}

function layoutWithDagre(
	nodes: Omit<GraphNode, 'x' | 'y'>[],
	edges: GraphEdge[],
): GraphNode[] {
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: 'LR', // Left to Right
		nodesep: 50, // Minimum vertical gap between nodes in the same column
		ranksep: 100, // Minimum horizontal gap between columns
	});
	g.setDefaultEdgeLabel(() => ({}));

	for (const node of nodes) {
		g.setNode(node.id, {
			width: node.width,
			height: node.height,
		});
	}
	for (const edge of edges) {
		if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
			g.setEdge(edge.from, edge.to);
		}
	}

	dagre.layout(g);

	return nodes.map((node) => {
		const pos = g.node(node.id);
		return { ...node, x: pos.x, y: pos.y };
	});
}

function expandTabs(code: string, filePath: string, cfg: GraphConfig): string {
	const ext = filePath.split('.').pop() ?? '';
	const tabSize = cfg.tabSizeByLanguage[ext] ?? cfg.tabSize;
	return code.replace(/\t/g, ' '.repeat(tabSize));
}

function extractCode(content: string, filePath: string, cfg: GraphConfig): string {
	const match = content.match(/# Code\s+```[^\n]*\n([\s\S]*?)\n```/);
	return match ? expandTabs(match[1], filePath, cfg) : '';
}

export async function buildGraphData(): Promise<GraphData> {
	const marks = await getMarks();
	log(`buildGraphData: ${marks.length} marks`);
	const contents = await Promise.all(
		marks.map((mark) =>
			vscode.workspace.fs
				.readFile(mark.uri)
				.then((bytes) => Buffer.from(bytes).toString('utf-8')),
		),
	);
	const cfg = loadConfig();
	const rawNodes = marks.map((mark, idx) => {
		const label = nodeLabel(mark.fm);
		const code = extractCode(contents[idx], mark.fm.file, cfg);
		const size = measureNodeSize(label, code);
		return {
			id: mark.markId,
			label,
			code,
			file: `${mark.fm.file}#L${mark.fm.startLine}-L${mark.fm.endLine}`,
			color: nodeColor(cfg, mark.fm.symbolKind),
			width: size.width,
			height: size.height,
		};
	});

	const edges: GraphEdge[] = [];
	for (const mark of marks) {
		for (const link of mark.fm.uses ?? []) {
			const target = link.replace(`code-trail:${OUTPUT_DIR}/`, '');
			edges.push({ from: mark.markId, to: target });
		}
	}

	const nodes = layoutWithDagre(rawNodes, edges);

	log(`buildGraphData: ${nodes.length} nodes, ${edges.length} edges`);
	return { nodes, edges };
}
