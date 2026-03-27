import * as vscode from 'vscode';
import { buildSelectionInfo } from '../utils/selection';
import { getSymbolAtPosition } from '../utils/symbol';
import { saveMark, findExistingMark } from '../utils/mark';
import { getGitHubUrl } from '../utils/git';
import { parseFrontmatter } from '../utils/frontmatter';
import { log } from '../utils/logger';
import { promptAndLink } from '../utils/link';

export async function markCode(): Promise<void> {
	log('markCode: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('markCode: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	if (!vscode.workspace.workspaceFolders) {
		log('markCode: no workspace folder found');
		vscode.window.showWarningMessage('No workspace folder found.');
		return;
	}

	const symbolInfo = await getSymbolAtPosition(
		editor.document.uri,
		editor.selection.start,
	);
	log(`markCode: symbolInfo=${JSON.stringify(symbolInfo)}`);

	let range: vscode.Range;
	if (symbolInfo) {
		range = symbolInfo.range;
	} else if (!editor.selection.isEmpty) {
		range = editor.selection;
	} else {
		log('markCode: no selection or symbol found');
		vscode.window.showWarningMessage('No selection or symbol found at cursor.');
		return;
	}

	const info = buildSelectionInfo(editor.document, range, symbolInfo);
	const { selectedText: _, ...logInfo } = info;
	log(`markCode: selectionInfo=${JSON.stringify(logInfo)}`);

	if (info.symbol) {
		const existing = await findExistingMark(info.filePath, info.symbol);
		if (existing) {
			log(`markCode: duplicate mark found ${existing.markId}`);
			vscode.window.showWarningMessage(
				`Mark already exists: ${existing.markId}`,
			);
			const doc = await vscode.workspace.openTextDocument(existing.uri);
			await vscode.window.showTextDocument(doc);
			return;
		}
	}

	const githubUrl = getGitHubUrl(info.filePath, info.startLine, info.endLine);

	try {
		const fileUri = await saveMark(info, new Date(), githubUrl);
		log(`markCode: saved ${fileUri.fsPath}`);
		const doc = await vscode.workspace.openTextDocument(fileUri);
		await vscode.window.showTextDocument(doc);
		vscode.window.showInformationMessage(
			`Saved: ${fileUri.fsPath.split('/').pop()}`,
		);

		// Suggest links based on call hierarchy
		const content = (await vscode.workspace.fs.readFile(fileUri)).toString();
		const fm = parseFrontmatter(content);
		if (fm) {
			await promptAndLink(fileUri, fm);
		}
	} catch (e) {
		log(`markCode: failed to save mark: ${e}`);
		vscode.window.showErrorMessage(`Failed to save mark: ${e}`);
	}
}
