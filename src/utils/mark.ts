import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { parseFrontmatter, type Frontmatter } from './frontmatter';
import type { SelectionInfo } from './selection';
import { log } from './logger';

const LANGUAGE_ID_TO_TAG: Record<string, string> = {
	typescript: 'ts',
	typescriptreact: 'tsx',
	javascript: 'js',
	javascriptreact: 'jsx',
	python: 'py',
	go: 'go',
	rust: 'rs',
	c: 'c',
	cpp: 'cpp',
	java: 'java',
	ruby: 'rb',
	php: 'php',
	swift: 'swift',
	kotlin: 'kotlin',
	scala: 'scala',
	shellscript: 'sh',
	sql: 'sql',
	html: 'html',
	css: 'css',
	json: 'json',
	yaml: 'yaml',
	toml: 'toml',
	xml: 'xml',
	markdown: 'md',
};

function getLanguageTag(languageId: string): string {
	return LANGUAGE_ID_TO_TAG[languageId] ?? languageId;
}

export function formatMark(
	info: SelectionInfo,
	exportedAt: Date,
	githubUrl?: string,
): string {
	const lang = getLanguageTag(info.languageId);
	const timestamp = exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');

	const link = `code-trail:${info.filePath}#L${info.startLine}-L${info.endLine}`;

	const frontmatter = [
		'---',
		`file: ${info.filePath}`,
		`range: L${info.startLine}-L${info.endLine}`,
		`link: ${link}`,
		`exportedAt: ${timestamp}`,
	];
	if (info.symbol) {
		frontmatter.push(`symbol: ${info.symbol}`);
	}
	if (info.symbolKind) {
		frontmatter.push(`symbolKind: ${info.symbolKind}`);
	}
	if (githubUrl) {
		frontmatter.push(`github: ${githubUrl}`);
	}
	frontmatter.push('---');

	return `${frontmatter.join('\n')}

# Notes

<!-- write notes here -->

# Code

\`\`\`${lang}
${info.selectedText}
\`\`\`
`;
}

export function generateMarkFileName(
	info: SelectionInfo,
	exportedAt: Date,
): string {
	const zeroPad = (n: number) => String(n).padStart(2, '0');
	const dt = exportedAt;
	const dtStr = `${dt.getFullYear()}${zeroPad(dt.getMonth() + 1)}${zeroPad(dt.getDate())}-${zeroPad(dt.getHours())}${zeroPad(dt.getMinutes())}${zeroPad(dt.getSeconds())}`;
	const fileName = info.fileName.replaceAll('.', '-');
	const parts = [dtStr, fileName];
	if (info.symbol) {
		parts.push(info.symbol.replaceAll('.', '-').replaceAll(' ', '-'));
	}
	return `${parts.join('_')}.md`;
}

export async function saveMark(
	info: SelectionInfo,
	exportedAt: Date,
	githubUrl?: string,
): Promise<vscode.Uri> {
	log(`saveMark: file=${info.filePath} symbol=${info.symbol}`);
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}

	const content = formatMark(info, exportedAt, githubUrl);
	const fileName = generateMarkFileName(info, exportedAt);

	const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, OUTPUT_DIR);
	await vscode.workspace.fs.createDirectory(dirUri);

	const fileUri = vscode.Uri.joinPath(dirUri, fileName);
	await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
	log(`saveMark: wrote ${fileUri.fsPath}`);
	return fileUri;
}

export interface MarkInfo {
	markId: string;
	uri: vscode.Uri;
	fm: Frontmatter;
}

export async function findExistingMark(
	filePath: string,
	symbol: string,
): Promise<MarkInfo | undefined> {
	log(`findExistingMark: file=${filePath} symbol=${symbol}`);
	const marks = await getMarks();
	const found = marks.find(
		(m) => m.fm.file === filePath && m.fm.symbol === symbol,
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
			const fm = parseFrontmatter(content);
			if (!fm) {
				return undefined;
			}
			return { markId: path.basename(uri.fsPath), uri, fm };
		}),
	);
	return results.filter((m): m is MarkInfo => m !== undefined);
}
