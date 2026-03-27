import { OUTPUT_DIR } from '../config';
import { getMarks } from './mark';
import type { Frontmatter } from './frontmatter';
import { log } from './logger';
import dagre from '@dagrejs/dagre';

export interface GraphNode {
	id: string;
	label: string;
	color: string;
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

const SYMBOL_KIND_TO_COLOR: Record<string, string> = {
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

export function nodeColor(symbolKind?: string): string {
	return SYMBOL_KIND_TO_COLOR[symbolKind ?? ''] ?? DEFAULT_COLOR;
}

const CHAR_WIDTH = 8;
const NODE_PADDING = 20;
const NODE_HEIGHT = 40;

function estimateNodeWidth(label: string): number {
	return label.length * CHAR_WIDTH + NODE_PADDING * 2;
}

function layoutWithDagre(
	nodes: Omit<GraphNode, 'x' | 'y'>[],
	edges: GraphEdge[],
): GraphNode[] {
	const g = new dagre.graphlib.Graph();
	g.setGraph({
		rankdir: 'LR', // Left-to-right layout
		nodesep: 30, // Minimum vertical spacing between nodes in the same rank
		ranksep: 80, // Horizontal spacing between ranks (columns)
	});
	g.setDefaultEdgeLabel(() => ({}));

	for (const node of nodes) {
		g.setNode(node.id, {
			label: node.label,
			width: estimateNodeWidth(node.label),
			height: NODE_HEIGHT,
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

export async function buildGraphData(): Promise<GraphData> {
	const marks = await getMarks();
	log(`buildGraphData: ${marks.length} marks`);
	const rawNodes = marks.map((m) => ({
		id: m.markId,
		label: nodeLabel(m.fm),
		color: nodeColor(m.fm.symbolKind),
	}));

	const edges: GraphEdge[] = [];
	for (const m of marks) {
		for (const link of m.fm.uses ?? []) {
			const target = link.replace(`code-trail:${OUTPUT_DIR}/`, '');
			edges.push({ from: m.markId, to: target });
		}
	}

	const nodes = layoutWithDagre(rawNodes, edges);

	log(`buildGraphData: ${nodes.length} nodes, ${edges.length} edges`);
	return { nodes, edges };
}
