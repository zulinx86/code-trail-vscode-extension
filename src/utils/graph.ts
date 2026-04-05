import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { Mark } from './mark';
import { log } from './logger';
import dagre from '@dagrejs/dagre';

// Node layout constants (shared with src/webview/graph.html via template
// placeholders). Font sizes are loaded from config; others are derived.
export const PADDING = 12;
export let CODE_FONT_SIZE = 18;
export let CODE_LINE_HEIGHT = CODE_FONT_SIZE * 1.4;
export let CODE_CHAR_WIDTH = CODE_FONT_SIZE * 0.62;
export let HEADER_FONT_SIZE = 20;
export let HEADER_HEIGHT = HEADER_FONT_SIZE + PADDING * 2;
export let HEADER_CHAR_WIDTH = HEADER_FONT_SIZE * 0.62;
export let TITLE_FONT_SIZE = 32;
export let TITLE_CHAR_WIDTH = TITLE_FONT_SIZE * 0.62;
export let TITLE_HEIGHT = TITLE_FONT_SIZE + PADDING * 2;
export let EXT_LABEL_FONT_SIZE = 14;
export const EXT_LABEL_GAP = 4;

function applyFontSizes(
	fontSize: number,
	headerFontSize: number,
	labelFontSize: number,
	titleFontSize: number,
): void {
	CODE_FONT_SIZE = fontSize;
	CODE_LINE_HEIGHT = CODE_FONT_SIZE * 1.4;
	CODE_CHAR_WIDTH = CODE_FONT_SIZE * 0.62;
	HEADER_FONT_SIZE = headerFontSize;
	HEADER_HEIGHT = HEADER_FONT_SIZE + PADDING * 2;
	HEADER_CHAR_WIDTH = HEADER_FONT_SIZE * 0.62;
	TITLE_FONT_SIZE = titleFontSize;
	TITLE_CHAR_WIDTH = TITLE_FONT_SIZE * 0.62;
	TITLE_HEIGHT = TITLE_FONT_SIZE + PADDING * 2;
	EXT_LABEL_FONT_SIZE = labelFontSize;
}

export interface GraphNode {
	id: string;
	label: string;
	code: string;
	file: string;
	color: string;
	isTitle: boolean;
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
	title: '#FFFFFF',
};
const DEFAULT_COLOR = '#DBDBDB';

interface GraphConfig {
	tabSize: number;
	tabSizeByLanguage: Record<string, number>;
	symbolColors: Record<string, string>;
}

function loadConfig(): GraphConfig {
	const config = vscode.workspace.getConfiguration('codeTrail');
	applyFontSizes(
		config.get<number>('graphCodeFontSize', 18),
		config.get<number>('graphHeaderFontSize', 20),
		config.get<number>('graphLabelFontSize', 14),
		config.get<number>('graphTitleFontSize', 32),
	);
	return {
		tabSize: config.get<number>('tabSize', 4),
		tabSizeByLanguage: config.get<Record<string, number>>(
			'tabSizeByLanguage',
			{},
		),
		symbolColors: config.get<Record<string, string>>('symbolColors', {}),
	};
}

export function nodeLabel(mark: Mark): string {
	if (mark.symbolKind === 'title') {
		return mark.symbol ?? '';
	}
	if (!mark.symbol) {
		return `${mark.file}#L${mark.startLine}-L${mark.endLine}`;
	}
	if (
		mark.symbolKind === 'function' ||
		mark.symbolKind === 'method' ||
		mark.symbolKind === 'constructor'
	) {
		return `${mark.symbol}()`;
	}
	if (
		mark.symbolKind === 'enum' ||
		mark.symbolKind === 'struct' ||
		mark.symbolKind === 'class' ||
		mark.symbolKind === 'interface' ||
		mark.symbolKind === 'const'
	) {
		return `${mark.symbolKind} ${mark.symbol}`;
	}
	return mark.symbol;
}

export function nodeColor(cfg: GraphConfig, symbolKind?: string): string {
	const kind = symbolKind ?? '';
	if (Object.hasOwn(cfg.symbolColors, kind)) return cfg.symbolColors[kind];
	return DEFAULT_SYMBOL_COLORS[kind] ?? DEFAULT_COLOR;
}

export function measureNodeSize(
	label: string,
	code: string,
	isTitle?: boolean,
): { width: number; height: number } {
	if (isTitle) {
		const w = label.length * TITLE_CHAR_WIDTH + PADDING * 2;
		return { width: Math.max(w, 60), height: TITLE_HEIGHT };
	}
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
	const minCodeWidth = 80 * CODE_CHAR_WIDTH + PADDING * 2;
	const codeWidth = maxLineLen * CODE_CHAR_WIDTH + PADDING * 2;
	const codeHeight = lines.length * CODE_LINE_HEIGHT + PADDING * 2;
	return {
		width: Math.max(headerWidth, codeWidth, minCodeWidth),
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

function expandTabs(
	code: string | undefined,
	file: string,
	cfg: GraphConfig,
): string {
	if (!code) return '';
	const ext = file.split('.').pop() ?? '';
	const tabSize = Object.hasOwn(cfg.tabSizeByLanguage, ext)
		? cfg.tabSizeByLanguage[ext]
		: cfg.tabSize;
	return code.replace(/\t/g, ' '.repeat(tabSize));
}

export async function buildGraphData(): Promise<GraphData> {
	const marks = await Mark.getAll();
	log(`buildGraphData: ${marks.length} marks`);
	const cfg = loadConfig();
	const rawNodes = marks.map((mark) => {
		const label = nodeLabel(mark);
		const isTitle = mark.symbolKind === 'title';
		const code = isTitle ? '' : expandTabs(mark.code, mark.file, cfg);
		const size = measureNodeSize(label, code, isTitle);
		return {
			id: mark.id,
			label,
			code,
			file: isTitle ? '' : `${mark.file}#L${mark.startLine}-L${mark.endLine}`,
			color: nodeColor(cfg, mark.symbolKind),
			isTitle,
			width: size.width,
			height: size.height,
		};
	});

	const edges: GraphEdge[] = [];
	for (const mark of marks) {
		for (const conn of mark.uses ?? []) {
			const target = conn.replace(`code-trail:${OUTPUT_DIR}/`, '');
			edges.push({ from: mark.id, to: target });
		}
	}

	const nodes = layoutWithDagre(rawNodes, edges);

	log(`buildGraphData: ${nodes.length} nodes, ${edges.length} edges`);
	return { nodes, edges };
}
