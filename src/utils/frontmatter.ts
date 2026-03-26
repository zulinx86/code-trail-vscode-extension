import * as vscode from 'vscode';

export interface Frontmatter {
	file: string;
	startLine: number;
	endLine: number;
	symbol?: string;
	symbolKind?: string;
	link: string;
	github?: string;
	exportedAt: string;
	uses?: string[];
	usedBy?: string[];
}

export function parseFrontmatter(text: string): Frontmatter | undefined {
	const match = text.match(/^---\n([\s\S]*?)\n---/);
	if (!match) {
		return undefined;
	}
	const lines = match[1].split('\n');

	const fm: Record<string, string | string[]> = {};
	let currentKey = '';
	for (const line of lines) {
		const listItem = line.match(/^  - (.+)$/);
		if (listItem && currentKey) {
			const arr = fm[currentKey];
			if (Array.isArray(arr)) {
				arr.push(listItem[1]);
			}
			continue;
		}
		const kv = line.match(/^(\w+): (.+)$/);
		if (kv) {
			currentKey = kv[1];
			fm[currentKey] = kv[2];
			continue;
		}
		const listKey = line.match(/^(\w+):$/);
		if (listKey) {
			currentKey = listKey[1];
			fm[currentKey] = [];
		}
	}

	if (!fm.file || !fm.range || !fm.link || !fm.exportedAt) {
		return undefined;
	}

	const rangeMatch = (fm.range as string).match(/^L(\d+)-L(\d+)$/);
	if (!rangeMatch) {
		return undefined;
	}

	return {
		file: fm.file as string,
		startLine: parseInt(rangeMatch[1], 10),
		endLine: parseInt(rangeMatch[2], 10),
		symbol: fm.symbol as string | undefined,
		symbolKind: fm.symbolKind as string | undefined,
		link: fm.link as string,
		github: fm.github as string | undefined,
		exportedAt: fm.exportedAt as string,
		uses: fm.uses as string[] | undefined,
		usedBy: fm.usedBy as string[] | undefined,
	};
}

export async function addLink(
	fileUri: vscode.Uri,
	field: 'uses' | 'usedBy',
	targetMarkPath: string,
): Promise<void> {
	const content = Buffer.from(
		await vscode.workspace.fs.readFile(fileUri),
	).toString('utf-8');
	const lines = content.split('\n');
	const closeIdx = lines.indexOf('---', 1);
	if (closeIdx === -1) {
		return;
	}

	const entry = `code-trail:${targetMarkPath}`;
	const fieldIdx = lines.indexOf(`${field}:`);
	if (fieldIdx !== -1 && fieldIdx < closeIdx) {
		let i = fieldIdx + 1;
		while (i < closeIdx && lines[i].startsWith('  - ')) {
			if (lines[i] === `  - ${entry}`) {
				return;
			}
			i++;
		}
		lines.splice(i, 0, `  - ${entry}`);
	} else {
		lines.splice(closeIdx, 0, `${field}:`, `  - ${entry}`);
	}

	await vscode.workspace.fs.writeFile(
		fileUri,
		Buffer.from(lines.join('\n'), 'utf-8'),
	);
}
