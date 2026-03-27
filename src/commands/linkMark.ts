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
import { log } from '../utils/logger';

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
				log(`getCallHierarchyCandidates: symbol '${fm.symbol}' not found`);
				return { outgoing, incoming };
			}
			pos = symbolPos;
		} else {
			pos = new vscode.Position(fm.startLine - 1, 0);
		}

		// Prepare for provideOutgoingCalls and provideIncomingCalls
		log(`getCallHierarchyCandidates: preparing call hierarchy for ${fileUri.fsPath} L${pos.line + 1}`);
		const items = await vscode.commands.executeCommand<
			vscode.CallHierarchyItem[]
		>('vscode.prepareCallHierarchy', fileUri, pos);
		if (!items?.length) {
			log('getCallHierarchyCandidates: prepareCallHierarchy returned empty');
			return { outgoing, incoming };
		}
		const item = items[0];
		log(`getCallHierarchyCandidates: prepared call hiarchy (name=${item.name} kind=${item.kind})`);

		const wsRoot = workspaceFolder.fsPath;

		// Get outgoing calls
		const outCalls = await vscode.commands.executeCommand<
			vscode.CallHierarchyOutgoingCall[]
		>('vscode.provideOutgoingCalls', item);
		for (const call of outCalls ?? []) {
			log(`getCallHierarchyCandidates: outgoing item (name=${call.to.name} kind=${call.to.kind})`);
			outgoing.add(callItemToKey(wsRoot, call.to));
			outgoing.add(callItemToRangeKey(wsRoot, call.to));
		}

		// Get incoming calls
		const inCalls = await vscode.commands.executeCommand<
			vscode.CallHierarchyIncomingCall[]
		>('vscode.provideIncomingCalls', item);
		for (const call of inCalls ?? []) {
			log(`getCallHierarchyCandidates: incoming item (name=${call.from.name} kind=${call.from.kind})`);
			incoming.add(callItemToKey(wsRoot, call.from));
			incoming.add(callItemToRangeKey(wsRoot, call.from));
		}
		log(`getCallHierarchyCandidates: ${outgoing.size} outgoing, ${incoming.size} incoming`);
	} catch (e) {
		log(`getCallHierarchyCandidates: error ${e}`);
	}

	return { outgoing, incoming };
}

interface QuickPickCandidate extends vscode.QuickPickItem {
	mark: MarkInfo;
	direction: 'uses' | 'usedBy';
}

export async function linkMark(): Promise<void> {
	log('linkMark: started');
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		log('linkMark: no active editor found');
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const currentFm = parseFrontmatter(editor.document.getText());
	if (!currentFm) {
		log('linkMark: current file is not a valid mark');
		vscode.window.showWarningMessage('Current file is not a valid mark.');
		return;
	}
	log(`linkMark: current mark (file=${currentFm.file})`);

	// Get all the marks
	const currentMarkId = path.basename(editor.document.uri.fsPath);
	const marks = (await getMarks()).filter((p) => p.markId !== currentMarkId);
	log(`linkMark: found ${marks.length} other marks`);
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

	for (const mark of marks) {
		const key = markToKey(mark);
		log(`linkMark: checking mark ${mark.markId} key=${key}`);
		const isOutgoing = outgoing.has(key);
		const isIncoming = incoming.has(key);

		const desc = `${mark.fm.file}${mark.fm.symbol ? ' · ' + mark.fm.symbol : ''}`;

		if (isOutgoing) {
			items.push({
				label: `$(arrow-right) ${desc}`,
				description: mark.markId,
				detail: 'Suggested',
				mark: mark,
				direction: 'uses',
			});
		}
		if (isIncoming) {
			items.push({
				label: `$(arrow-left) ${desc}`,
				description: mark.markId,
				detail: 'Suggested',
				mark: mark,
				direction: 'usedBy',
			});
		}
		if (!isOutgoing && !isIncoming) {
			others.push({
				label: desc,
				description: mark.markId,
				mark: mark,
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
	log(`linkMark: linked ${currentMarkId} ${direction} ${targetMarkId}`);

	vscode.window.showInformationMessage(
		`Linked: ${currentMarkId} ${direction === 'uses' ? '→' : '←'} ${targetMarkId}`,
	);
}
