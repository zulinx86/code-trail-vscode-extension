import * as path from 'path';
import type { SelectionInfo } from './editor';

const LANGUAGE_ID_TO_TAG: Record<string, string> = {
	'typescript': 'ts',
	'typescriptreact': 'tsx',
	'javascript': 'js',
	'javascriptreact': 'jsx',
	'python': 'py',
	'go': 'go',
	'rust': 'rs',
	'c': 'c',
	'cpp': 'cpp',
	'java': 'java',
	'ruby': 'rb',
	'php': 'php',
	'swift': 'swift',
	'kotlin': 'kotlin',
	'scala': 'scala',
	'shellscript': 'sh',
	'sql': 'sql',
	'html': 'html',
	'css': 'css',
	'json': 'json',
	'yaml': 'yaml',
	'toml': 'toml',
	'xml': 'xml',
	'markdown': 'md',
};

function getLanguageTag(languageId: string): string {
	return LANGUAGE_ID_TO_TAG[languageId] ?? languageId;
}

export function formatRecord(info: SelectionInfo, exportedAt: Date): string {
	const lang = getLanguageTag(info.languageId);
	const timestamp = exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');

	const link = `code-atlas:${info.filePath}#L${info.startLine}-L${info.endLine}`;

	return `---
file: ${info.filePath}
range: ${info.startLine}-${info.endLine}
exportedAt: ${timestamp}
---

# Notes

<!-- write notes here -->

# Code

[${info.filePath}#L${info.startLine}-L${info.endLine}](${link})

\`\`\`${lang}
${info.selectedText}
\`\`\`
`;
}

export function generateFileName(info: SelectionInfo, exportedAt: Date): string {
	const zeroPad = (n: number) => String(n).padStart(2, '0');
	const dt = exportedAt;
	const dtStr = `${dt.getFullYear()}${zeroPad(dt.getMonth() + 1)}${zeroPad(dt.getDate())}-${zeroPad(dt.getHours())}${zeroPad(dt.getMinutes())}${zeroPad(dt.getSeconds())}`;
	return `${dtStr}-${info.fileName}.md`;
}
