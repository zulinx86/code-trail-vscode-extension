import { OUTPUT_DIR } from '../config';
import { getMarks } from './mark';
import type { Frontmatter } from './frontmatter';
import { log } from './logger';

export interface GraphNode {
	id: string;
	label: string;
	color: string;
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

export async function buildGraphData(): Promise<GraphData> {
	const marks = await getMarks();
	log(`buildGraphData: ${marks.length} marks`);
	const nodes: GraphNode[] = marks.map((m) => ({
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

	log(`buildGraphData: ${nodes.length} nodes, ${edges.length} edges`);
	return { nodes, edges };
}
