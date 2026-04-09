import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { Mark } from './mark';
import { log } from './logger';
import dagre from '@dagrejs/dagre';

export interface GraphNode {
	id: string;
	header: string;
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

export class GraphFonts {
	readonly PADDING: number = 12;
	readonly CODE_FONT_SIZE: number;
	readonly CODE_LINE_HEIGHT: number;
	readonly CODE_CHAR_WIDTH: number;
	readonly HEADER_FONT_SIZE: number;
	readonly HEADER_HEIGHT: number;
	readonly HEADER_CHAR_WIDTH: number;
	readonly TITLE_FONT_SIZE: number;
	readonly TITLE_HEIGHT: number;
	readonly TITLE_CHAR_WIDTH: number;
	readonly LABEL_FONT_SIZE: number;
	readonly LABEL_GAP: number = 4;

	constructor(
		codeFrontSize: number,
		headerFontSize: number,
		titleFontSize: number,
		labelFontSize: number,
	) {
		this.CODE_FONT_SIZE = codeFrontSize ?? 18;
		this.CODE_LINE_HEIGHT = this.CODE_FONT_SIZE * 1.4;
		this.CODE_CHAR_WIDTH = this.CODE_FONT_SIZE * 0.62;
		this.HEADER_FONT_SIZE = headerFontSize ?? 20;
		this.HEADER_HEIGHT = this.HEADER_FONT_SIZE + this.PADDING * 2;
		this.HEADER_CHAR_WIDTH = this.HEADER_FONT_SIZE * 0.62;
		this.TITLE_FONT_SIZE = titleFontSize ?? 32;
		this.TITLE_HEIGHT = this.TITLE_FONT_SIZE + this.PADDING * 2;
		this.TITLE_CHAR_WIDTH = this.TITLE_FONT_SIZE * 0.62;
		this.LABEL_FONT_SIZE = labelFontSize ?? 14;
	}

	dump(): Record<string, number> {
		return {
			PADDING: this.PADDING,
			CODE_FONT_SIZE: this.CODE_FONT_SIZE,
			CODE_LINE_HEIGHT: this.CODE_LINE_HEIGHT,
			CODE_CHAR_WIDTH: this.CODE_CHAR_WIDTH,
			HEADER_FONT_SIZE: this.HEADER_FONT_SIZE,
			HEADER_HEIGHT: this.HEADER_HEIGHT,
			HEADER_CHAR_WIDTH: this.HEADER_CHAR_WIDTH,
			TITLE_FONT_SIZE: this.TITLE_FONT_SIZE,
			TITLE_HEIGHT: this.TITLE_HEIGHT,
			TITLE_CHAR_WIDTH: this.TITLE_CHAR_WIDTH,
			LABEL_FONT_SIZE: this.LABEL_FONT_SIZE,
			LABEL_GAP: this.LABEL_GAP,
		};
	}
}

export class GraphConfig {
	constructor(
		readonly fonts: GraphFonts,
		readonly tabSize: number,
		readonly tabSizeByLanguage: Record<string, number>,
		readonly symbolColors: Record<string, string>,
	) {}

	static fromConfig() {
		const config = vscode.workspace.getConfiguration('codeTrail');
		const fonts = new GraphFonts(
			config.get<number>('graphCodeFontSize', 18),
			config.get<number>('graphHeaderFontSize', 20),
			config.get<number>('graphTitleFontSize', 32),
			config.get<number>('graphLabelFontSize', 14),
		);
		const tabSize = config.get<number>('tabSize', 4);
		const tabSizeByLanguage = config.get<Record<string, number>>(
			'tabSizeByLanguage',
			{},
		);
		const symbolColors = config.get<Record<string, string>>('symbolColors', {});
		return new GraphConfig(fonts, tabSize, tabSizeByLanguage, symbolColors);
	}

	tabSizeForLanguage(ext: string): number {
		return Object.hasOwn(this.tabSizeByLanguage, ext)
			? this.tabSizeByLanguage[ext]
			: this.tabSize;
	}

	colorForSymbolKind(symbolKind?: string): string {
		const kind = symbolKind ?? '';
		if (Object.hasOwn(this.symbolColors, kind)) return this.symbolColors[kind];
		switch (kind) {
			case 'function':
			case 'method':
			case 'constructor':
				return '#A8D8F0';
			case 'class':
			case 'struct':
				return '#A8E6CF';
			case 'enum':
				return '#FFE0B2';
			case 'interface':
				return '#D7BDE2';
			case 'const':
				return '#F5B7B1';
			case 'title':
				return '#FFFFFF';
		}
		return '#DBDBDB';
	}
}

export class Graph {
	private constructor(
		readonly data: GraphData,
		readonly config: GraphConfig,
	) {}

	static fromMarks(marks: Mark[]) {
		const cfg = GraphConfig.fromConfig();

		const rawNodes = marks.map((mark) => {
			const header = Graph.getHeader(mark);
			const isTitle = mark.symbolKind === 'title';
			const code = isTitle ? '' : Graph.formatCode(mark.code, mark.file, cfg);
			const size = Graph.calcNodeSize(header, code, isTitle, cfg);
			return {
				id: mark.id,
				header,
				code,
				file: isTitle ? '' : `${mark.file}#L${mark.startLine}-L${mark.endLine}`,
				color: cfg.colorForSymbolKind(mark.symbolKind),
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

		const nodes = Graph.layoutWithDagre(rawNodes, edges);

		log(`Graph.fromMarks: ${nodes.length} nodes, ${edges.length} edges}`);
		return new Graph({ nodes, edges }, cfg);
	}

	static getHeader(mark: Mark): string {
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

	private static formatCode(
		code: string | undefined,
		file: string,
		cfg: GraphConfig,
	): string {
		if (!code) return '';
		const ext = file.split('.').pop() ?? '';
		const tabSize = cfg.tabSizeForLanguage(ext);
		return code.replace(/\t/g, ' '.repeat(tabSize));
	}

	private static calcNodeSize(
		header: string,
		code: string,
		isTitle: boolean,
		cfg: GraphConfig,
	): { width: number; height: number } {
		if (isTitle) {
			const width =
				cfg.fonts.TITLE_CHAR_WIDTH * header.length + cfg.fonts.PADDING * 2;
			return { width: Math.max(width, 60), height: cfg.fonts.TITLE_HEIGHT };
		}

		const headerWidth =
			cfg.fonts.HEADER_CHAR_WIDTH * header.length + cfg.fonts.PADDING * 2;
		if (!code) {
			return {
				width: Math.max(headerWidth, 60),
				height: cfg.fonts.HEADER_HEIGHT,
			};
		}

		const lines = code.split('\n');
		let maxLineLen = 0;
		for (const line of lines) {
			if (line.length > maxLineLen) {
				maxLineLen = line.length;
			}
		}
		const codeWidth =
			cfg.fonts.CODE_CHAR_WIDTH * maxLineLen + cfg.fonts.PADDING * 2;
		const codeHeight =
			cfg.fonts.CODE_LINE_HEIGHT * lines.length + cfg.fonts.PADDING * 2;
		const minCodeWidth = cfg.fonts.CODE_CHAR_WIDTH * 80 + cfg.fonts.PADDING * 2;
		return {
			width: Math.max(headerWidth, codeWidth, minCodeWidth),
			height: cfg.fonts.HEADER_HEIGHT + codeHeight,
		};
	}

	private static layoutWithDagre(
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

		// Set order on target nodes so that dagre respects the uses
		// declaration order (top to bottom = first to last).
		const outgoing = new Map<string, string[]>();
		for (const edge of edges) {
			// Set edge
			if (!g.hasNode(edge.from) || !g.hasNode(edge.to)) continue;
			g.setEdge(edge.from, edge.to);

			// Build outgoing
			let targets = outgoing.get(edge.from);
			if (!targets) {
				targets = [];
				outgoing.set(edge.from, targets);
			}
			targets.push(edge.to);
		}
		for (const targets of outgoing.values()) {
			for (let i = 0; i < targets.length; i++) {
				g.node(targets[i]).order = i;
			}
		}

		dagre.layout(g, { disableOptimalOrderHeuristic: true });

		return nodes.map((node) => {
			const pos = g.node(node.id);
			return { ...node, x: pos.x, y: pos.y };
		});
	}

	stringify(): string {
		// Convert GraphData to JSON string.
		const stage1 = JSON.stringify(this.data);
		// Escape '<' and '>' to Unicode so that strings like "</script>" in
		// code snippets don't break the HTML <script> tag.
		const stage2 = stage1.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
		// Wrap the result as a quoted string literal, so it can be embedded in
		// the HTML template as JSON.parse(...).
		const stage3 = JSON.stringify(stage2);
		return stage3;
	}
}
