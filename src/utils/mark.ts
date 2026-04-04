import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { Selection } from './selection';
import { log } from './logger';

export interface MarkArgs {
	file: string;
	startLine: number;
	endLine: number;
	symbol?: string;
	symbolKind?: string;
	link: string;
	github?: string;
	exportedAt: Date;
	uses?: string[];
	usedBy?: string[];
	code?: string;
}

export class Mark {
	readonly file: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly symbol?: string;
	readonly symbolKind?: string;
	readonly link: string;
	readonly github?: string;
	readonly exportedAt: string;
	uses?: string[];
	usedBy?: string[];
	code?: string;

	constructor(params: MarkArgs) {
		this.file = params.file;
		this.startLine = params.startLine;
		this.endLine = params.endLine;
		this.symbol = params.symbol;
		this.symbolKind = params.symbolKind;
		this.link = params.link;
		this.github = params.github;
		this.exportedAt = params.exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
		this.uses = params.uses;
		this.usedBy = params.usedBy;
		this.code = params.code;
	}

	static fromText(text: string): Mark | undefined {
		const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
		if (!frontmatterMatch) {
			return undefined;
		}

		const lines = frontmatterMatch[1].split('\n');
		const frontmatter: Record<string, string | string[]> = {};
		let currentKey = '';
		for (const line of lines) {
			const listItem = line.match(/^  - (.+)$/);
			if (listItem && currentKey) {
				const arr = frontmatter[currentKey];
				if (Array.isArray(arr)) {
					arr.push(listItem[1]);
				}
				continue;
			}

			const kv = line.match(/^(\w+): (.+)$/);
			if (kv) {
				currentKey = kv[1];
				frontmatter[currentKey] = kv[2];
				continue;
			}

			const listKey = line.match(/^(\w+):$/);
			if (listKey) {
				currentKey = listKey[1];
				frontmatter[currentKey] = [];
			}
		}

		if (
			!frontmatter.file ||
			!frontmatter.range ||
			!frontmatter.link ||
			!frontmatter.exportedAt
		) {
			return undefined;
		}

		const rangeMatch = (frontmatter.range as string).match(/^L(\d+)-L(\d+)$/);
		if (!rangeMatch) {
			return undefined;
		}

		const codeMatch = text.match(/# Code\s+```[^\n]*\n([\s\S]*?)\n```/);
		const code = codeMatch ? codeMatch[1] : undefined;

		return new Mark({
			file: frontmatter.file as string,
			startLine: parseInt(rangeMatch[1], 10),
			endLine: parseInt(rangeMatch[2], 10),
			symbol: frontmatter.symbol as string | undefined,
			symbolKind: frontmatter.symbolKind as string | undefined,
			link: frontmatter.link as string,
			github: frontmatter.github as string | undefined,
			exportedAt: new Date(frontmatter.exportedAt as string),
			uses: frontmatter.uses as string[] | undefined,
			usedBy: frontmatter.usedBy as string[] | undefined,
			code: code,
		});
	}

	static fromSelection(
		sel: Selection,
		exportedAt: Date = new Date(),
		github?: string,
	): Mark {
		return new Mark({
			file: sel.file,
			startLine: sel.startLine,
			endLine: sel.endLine,
			symbol: sel.symbol,
			symbolKind: sel.symbolKind,
			link: `code-trail:${sel.file}#L${sel.startLine}-L${sel.endLine}`,
			github,
			exportedAt,
			code: sel.selectedText,
		});
	}

	toString(): string {
		// Frontmatter
		const frontmatter = [
			'---',
			`file: ${this.file}`,
			`range: L${this.startLine}-L${this.endLine}`,
			`link: ${this.link}`,
			`exportedAt: ${this.exportedAt}`,
		];
		if (this.symbol) {
			frontmatter.push(`symbol: ${this.symbol}`);
		}
		if (this.symbolKind) {
			frontmatter.push(`symbolKind: ${this.symbolKind}`);
		}
		if (this.github) {
			frontmatter.push(`github: ${this.github}`);
		}
		frontmatter.push('---');

		const ext = this.file.split('.').pop() ?? '';

		return `${frontmatter.join('\n')}

# Notes

<!-- write notes here -->

# Code

\`\`\`${ext}
${this.code}
\`\`\`
`;
	}

	toFilename(): string {
		const exportedAt = this.exportedAt.replace(
			/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*$/,
			'$1$2$3-$4$5$6',
		);
		const file = path
			.basename(this.file)
			.replaceAll('.', '-')
			.replaceAll(' ', '-');
		const parts = [exportedAt, file];
		if (this.symbol) {
			parts.push(this.symbol.replaceAll('.', '-').replaceAll(' ', '-'));
		}
		return `${parts.join('_')}.md`;
	}

	async save() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error('No workspace folder found.');
		}

		const content = this.toString();
		const filename = this.toFilename();

		const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, OUTPUT_DIR);
		await vscode.workspace.fs.createDirectory(dirUri);

		const fileUri = vscode.Uri.joinPath(dirUri, filename);
		await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
		return fileUri;
	}
}

export interface MarkInfo {
	markId: string;
	uri: vscode.Uri;
	mark: Mark;
	content: string;
}

export async function findExistingMark(
	file: string,
	symbol: string,
): Promise<MarkInfo | undefined> {
	log(`findExistingMark: file=${file} symbol=${symbol}`);
	const marks = await getMarks();
	const found = marks.find(
		(m) => m.mark.file === file && m.mark.symbol === symbol,
	);
	log(`findExistingMark: ${found ? `found ${found.markId}` : 'not found'}`);
	return found;
}

export async function getMarks(): Promise<MarkInfo[]> {
	const files = await vscode.workspace.findFiles(`${OUTPUT_DIR}/*.md`);
	log(`getMarks: found ${files.length} files in ${OUTPUT_DIR}/`);
	const results = await Promise.all(
		files.map(async (uri) => {
			const content = Buffer.from(
				await vscode.workspace.fs.readFile(uri),
			).toString('utf-8');
			const mark = Mark.fromText(content);
			if (!mark) {
				return undefined;
			}
			return { markId: path.basename(uri.fsPath), uri, mark, content };
		}),
	);
	return results.filter((m): m is MarkInfo => m !== undefined);
}
