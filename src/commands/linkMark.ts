import * as vscode from 'vscode';
import * as path from 'path';
import {
	parseFrontmatter,
	addLink,
	type Frontmatter,
} from '../utils/frontmatter';
import { getSymbolPos } from '../utils/symbol';
import { OUTPUT_DIR } from '../config';
import { type MarkInfo, getMarks } from '../utils/mark';

function markToKey(p: MarkInfo): string {
	return p.fm.symbol
		? `${p.fm.file}#${p.fm.symbol}`
		: `${p.fm.file}#L${p.fm.startLine}-L${p.fm.endLine}`;
}

function callItemToKey(wsRoot: string, item: vscode.CallHierarchyItem): string {
	const file = path.relative(wsRoot, item.uri.fsPath);
	// Use detail (parent class/module) + name for qualified matching
	const name = item.detail ? `${item.detail}.${item.name}` : item.name;
	return `${file}#${name}`;
}

function callItemToRangeKey(
	wsRoot: string,
	item: vscode.CallHierarchyItem,
): string {
	const file = path.relative(wsRoot, item.uri.fsPath);
	const start = item.range.start.line + 1;
	const end = item.range.end.line + 1;
	return `${file}#L${start}-L${end}`;
}

async function getCallHierarchyCandidates(
	fm: Frontmatter,
	workspaceFolder: vscode.Uri,
): Promise<{
	outgoing: Set<string>;
	incoming: Set<string>;
}> {
	const outgoing = new Set<string>();
	const incoming = new Set<string>();

	const fileUri = vscode.Uri.joinPath(workspaceFolder, fm.file);

	try {
		// Find symbol position for prepareCallHierarchy
		let pos: vscode.Position;
		if (fm.symbol) {
			const symbolPos = await getSymbolPos(fileUri, fm.symbol);
			if (!symbolPos) {
				return { outgoing, incoming };
			}
			pos = symbolPos;
		} else {
			pos = new vscode.Position(fm.startLine - 1, 0);
		}

		// Prepare for provideOutgoingCalls and provideIncomingCalls
		const items = await vscode.commands.executeCommand<
			vscode.CallHierarchyItem[]
		>('vscode.prepareCallHierarchy', fileUri, pos);
		if (!items?.length) {
			return { outgoing, incoming };
		}
		const item = items[0];

		const wsRoot = workspaceFolder.fsPath;

		// Get outgoing calls
		const outCalls = await vscode.commands.executeCommand<
			vscode.CallHierarchyOutgoingCall[]
		>('vscode.provideOutgoingCalls', item);
		for (const call of outCalls ?? []) {
			outgoing.add(callItemToKey(wsRoot, call.to));
			outgoing.add(callItemToRangeKey(wsRoot, call.to));
		}

		// Get incoming calls
		const inCalls = await vscode.commands.executeCommand<
			vscode.CallHierarchyIncomingCall[]
		>('vscode.provideIncomingCalls', item);
		for (const call of inCalls ?? []) {
			incoming.add(callItemToKey(wsRoot, call.from));
			incoming.add(callItemToRangeKey(wsRoot, call.from));
		}
	} catch {
		// Language server may not support call hierarchy
	}

	return { outgoing, incoming };
}

interface QuickPickCandidate extends vscode.QuickPickItem {
	mark: MarkInfo;
	direction: 'uses' | 'usedBy';
}

export async function linkMark(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const currentFm = parseFrontmatter(editor.document.getText());
	if (!currentFm) {
		vscode.window.showWarningMessage('Current file is not a valid mark.');
		return;
	}

	// Get all the marks
	const currentMarkId = path.basename(editor.document.uri.fsPath);
	const marks = (await getMarks()).filter((p) => p.markId !== currentMarkId);
	if (marks.length === 0) {
		vscode.window.showWarningMessage('No other marks found.');
		return;
	}

	// Get outgoing and incoming calls
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (!workspaceFolder) {
		return;
	}
	const { outgoing, incoming } = await getCallHierarchyCandidates(
		currentFm,
		workspaceFolder,
	);

	// Prepare candidates
	const items: QuickPickCandidate[] = [];
	const others: QuickPickCandidate[] = [];

	for (const p of marks) {
		const key = markToKey(p);
		const isOutgoing = outgoing.has(key);
		const isIncoming = incoming.has(key);

		const desc = `${p.fm.file}${p.fm.symbol ? ' · ' + p.fm.symbol : ''}`;

		if (isOutgoing) {
			items.push({
				label: `$(arrow-right) ${desc}`,
				description: p.markId,
				detail: 'Suggested',
				mark: p,
				direction: 'uses',
			});
		}
		if (isIncoming) {
			items.push({
				label: `$(arrow-left) ${desc}`,
				description: p.markId,
				detail: 'Suggested',
				mark: p,
				direction: 'usedBy',
			});
		}
		if (!isOutgoing && !isIncoming) {
			others.push({
				label: desc,
				description: p.markId,
				mark: p,
				direction: 'uses',
			});
		}
	}

	if (others.length > 0) {
		items.push({
			label: '',
			kind: vscode.QuickPickItemKind.Separator,
		} as any);
		items.push(...others);
	}

	// Wait for quick pick
	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select a mark to link',
	});
	if (!selected) {
		return;
	}

	// For non-suggested items, ask direction
	let direction = selected.direction;
	if (!selected.detail) {
		const dirChoice = await vscode.window.showQuickPick(
			[
				{
					label: '$(arrow-right)',
					description: 'uses',
					value: 'uses' as const,
				},
				{
					label: '$(arrow-left)',
					description: 'usedBy',
					value: 'usedBy' as const,
				},
			],
			{
				placeHolder: 'Select link direction',
			},
		);
		if (!dirChoice) {
			return;
		}
		direction = dirChoice.value;
	}

	const currentUri = editor.document.uri;
	const targetUri = selected.mark.uri;
	const targetMarkId = selected.mark.markId;
	const reverseDirection = direction === 'uses' ? 'usedBy' : 'uses';

	// Add links
	await addLink(currentUri, direction, `${OUTPUT_DIR}/${targetMarkId}`);
	await addLink(targetUri, reverseDirection, `${OUTPUT_DIR}/${currentMarkId}`);

	vscode.window.showInformationMessage(
		`Linked: ${currentMarkId} ${direction === 'uses' ? '→' : '←'} ${targetMarkId}`,
	);
}
