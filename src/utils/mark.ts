import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_DIR, workspaceFolder } from '../config';
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
	notes?: string;
	code?: string;
	uri?: vscode.Uri;
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
	notes?: string;
	code?: string;
	uri?: vscode.Uri;

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
		this.notes = params.notes;
		this.code = params.code;
		this.uri = params.uri;
	}

	static fromText(text: string, uri?: vscode.Uri): Mark | undefined {
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

		const notesMatch = text.match(/# Notes\s+([\s\S]*?)\s*(?:# Code|$)/);
		const notes = notesMatch ? notesMatch[1].trim() : undefined;

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
			notes: notes,
			code: code,
			uri,
		});
	}

	static async fromUri(uri: vscode.Uri): Promise<Mark | undefined> {
		const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
			'utf-8',
		);
		return Mark.fromText(text, uri);
	}

	static async fromFile(relativePath: string): Promise<Mark | undefined> {
		return Mark.fromUri(
			vscode.Uri.joinPath(workspaceFolder!.uri, relativePath),
		);
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

	static fromTitle(title: string, exportedAt: Date = new Date()): Mark {
		return new Mark({
			file: 'title',
			startLine: 0,
			endLine: 0,
			link: 'code-trail:title',
			symbol: title,
			symbolKind: 'title',
			exportedAt,
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
		if (this.uses && this.uses.length > 0) {
			frontmatter.push('uses:');
			for (const item of this.uses) {
				frontmatter.push(`  - ${item}`);
			}
		}
		if (this.usedBy && this.usedBy.length > 0) {
			frontmatter.push('usedBy:');
			for (const item of this.usedBy) {
				frontmatter.push(`  - ${item}`);
			}
		}
		frontmatter.push('---');

		const ext = this.file.split('.').pop() ?? '';

		return `${frontmatter.join('\n')}

# Notes

${this.notes ? this.notes : '<!-- write notes here -->'}

# Code

\`\`\`${ext}
${this.code}
\`\`\`
`;
	}

	/**
	 * Resolves the mark's file path to an absolute path.
	 * For external (absolute) paths, returns as-is.
	 * For workspace-relative paths, resolves against the workspace folder.
	 */
	get absolutePath(): string {
		if (path.isAbsolute(this.file)) {
			return this.file;
		}
		return path.resolve(workspaceFolder!.uri.fsPath, this.file);
	}

	/**
	 * Resolves the mark's file path to a vscode.Uri.
	 */
	get fileUri(): vscode.Uri {
		if (path.isAbsolute(this.file)) {
			return vscode.Uri.file(this.file);
		}
		return vscode.Uri.joinPath(workspaceFolder!.uri, this.file);
	}

	get id(): string {
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
		const content = this.toString();
		const filename = this.id;

		const dirUri = vscode.Uri.joinPath(workspaceFolder!.uri, OUTPUT_DIR);
		await vscode.workspace.fs.createDirectory(dirUri);

		const fileUri = vscode.Uri.joinPath(dirUri, filename);
		await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
		this.uri = fileUri;
		return fileUri;
	}

	async connect(field: 'uses' | 'usedBy', markId: string) {
		if (!this[field]) {
			this[field] = [];
		}

		const item = `code-trail:${OUTPUT_DIR}/${markId}`;
		if (!this[field]?.includes(item)) {
			this[field]?.push(item);
		}

		await this.save();
	}

	static async getAll(): Promise<Mark[]> {
		const uris = await vscode.workspace.findFiles(`${OUTPUT_DIR}/*.md`);
		// Sort by file path so that the order is deterministic across reloads.
		uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
		log(`Mark.getAll: found ${uris.length} files in ${OUTPUT_DIR}/`);
		const marks = await Promise.all(
			uris.map(async (uri) => {
				return await Mark.fromUri(uri);
			}),
		);
		return marks.filter((mark): mark is Mark => mark !== undefined);
	}

	static async find(file: string, symbol: string): Promise<Mark | undefined> {
		log(`Mark.findMark: file=${file} symbol=${symbol}`);
		const marks = await Mark.getAll();
		const found = marks.find(
			(mark) => mark.file === file && mark.symbol === symbol,
		);
		log(`Mark.findMark: ${found ? `found ${found.id}` : 'not found'}`);
		return found;
	}
}
