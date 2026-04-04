import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_DIR } from '../config';
import { parseFrontmatter, type Frontmatter } from './frontmatter';
import { Selection } from './selection';
import { log } from './logger';

export function formatMark(
	selection: Selection,
	exportedAt: Date,
	githubUrl?: string,
): string {
	const ext = selection.filePath.split('.').pop() ?? '';
	const timestamp = exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');

	const link = `code-trail:${selection.filePath}#L${selection.startLine}-L${selection.endLine}`;

	const frontmatter = [
		'---',
		`file: ${selection.filePath}`,
		`range: L${selection.startLine}-L${selection.endLine}`,
		`link: ${link}`,
		`exportedAt: ${timestamp}`,
	];
	if (selection.symbol) {
		frontmatter.push(`symbol: ${selection.symbol}`);
	}
	if (selection.symbolKind) {
		frontmatter.push(`symbolKind: ${selection.symbolKind}`);
	}
	if (githubUrl) {
		frontmatter.push(`github: ${githubUrl}`);
	}
	frontmatter.push('---');

	return `${frontmatter.join('\n')}

# Notes

<!-- write notes here -->

# Code

\`\`\`${ext}
${selection.selectedText}
\`\`\`
`;
}

export function generateMarkFileName(
	selection: Selection,
	exportedAt: Date,
): string {
	const zeroPad = (n: number) => String(n).padStart(2, '0');
	const dt = exportedAt;
	const dtStr = `${dt.getFullYear()}${zeroPad(dt.getMonth() + 1)}${zeroPad(dt.getDate())}-${zeroPad(dt.getHours())}${zeroPad(dt.getMinutes())}${zeroPad(dt.getSeconds())}`;
	const fileName = path.basename(selection.filePath).replaceAll('.', '-');
	const parts = [dtStr, fileName];
	if (selection.symbol) {
		parts.push(selection.symbol.replaceAll('.', '-').replaceAll(' ', '-'));
	}
	return `${parts.join('_')}.md`;
}

export async function saveMark(
	selection: Selection,
	exportedAt: Date,
	githubUrl?: string,
): Promise<vscode.Uri> {
	log(`saveMark: file=${selection.filePath} symbol=${selection.symbol}`);
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}

	const content = formatMark(selection, exportedAt, githubUrl);
	const fileName = generateMarkFileName(selection, exportedAt);

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
	content: string;
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
			return { markId: path.basename(uri.fsPath), uri, fm, content };
		}),
	);
	return results.filter((m): m is MarkInfo => m !== undefined);
}
