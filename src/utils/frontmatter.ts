import * as vscode from 'vscode';
import { log } from './logger';

export async function addLink(
	fileUri: vscode.Uri,
	field: 'uses' | 'usedBy',
	targetMarkPath: string,
): Promise<void> {
	log(`addLink: ${fileUri.fsPath} ${field} ${targetMarkPath}`);
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
