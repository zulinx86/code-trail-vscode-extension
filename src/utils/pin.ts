import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { parseFrontmatter, type Frontmatter } from './frontmatter';
import type { SelectionInfo } from './selection';

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

export function formatPin(
	info: SelectionInfo,
	exportedAt: Date,
	githubUrl?: string,
): string {
	const lang = getLanguageTag(info.languageId);
	const timestamp = exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');

	const link = `code-atlas:${info.filePath}#L${info.startLine}-L${info.endLine}`;

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

export function generatePinFileName(
	info: SelectionInfo,
	exportedAt: Date,
): string {
	const zeroPad = (n: number) => String(n).padStart(2, '0');
	const dt = exportedAt;
	const dtStr = `${dt.getFullYear()}${zeroPad(dt.getMonth() + 1)}${zeroPad(dt.getDate())}-${zeroPad(dt.getHours())}${zeroPad(dt.getMinutes())}${zeroPad(dt.getSeconds())}`;
	const fileName = info.fileName.replaceAll('.', '-');
	const parts = [dtStr, fileName];
	if (info.symbol) {
		parts.push(info.symbol.replaceAll('.', '-'));
	}
	return `${parts.join('_')}.md`;
}

export async function savePin(
	info: SelectionInfo,
	exportedAt: Date,
	githubUrl?: string,
): Promise<vscode.Uri> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}

	const content = formatPin(info, exportedAt, githubUrl);
	const fileName = generatePinFileName(info, exportedAt);

	const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, OUTPUT_DIR);
	await vscode.workspace.fs.createDirectory(dirUri);

	const fileUri = vscode.Uri.joinPath(dirUri, fileName);
	await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
	return fileUri;
}

export interface PinInfo {
	pinId: string;
	uri: vscode.Uri;
	fm: Frontmatter;
}

export async function getPins(): Promise<PinInfo[]> {
	const files = await vscode.workspace.findFiles(`${OUTPUT_DIR}/*.md`);
	const pins: PinInfo[] = [];
	for (const uri of files) {
		const content = Buffer.from(
			await vscode.workspace.fs.readFile(uri),
		).toString('utf-8');
		const fm = parseFrontmatter(content);
		if (fm) {
			pins.push({
				pinId: path.basename(uri.fsPath),
				uri,
				fm,
			});
		}
	}
	return pins;
}
