import * as vscode from 'vscode';
import * as path from 'path';
import { Symbol } from './symbol';
import { Mark, getMarks } from './mark';
import { OUTPUT_DIR } from '../config';
import { log } from './logger';

export function callItemToNameKey(
	wsRoot: string,
	item: vscode.CallHierarchyItem,
): string {
	const file = path.relative(wsRoot, item.uri.fsPath);
	return `${file}#${item.name}`;
}

export function callItemToRangeKey(
	wsRoot: string,
	item: vscode.CallHierarchyItem,
): string {
	const file = path.relative(wsRoot, item.uri.fsPath);
	const start = item.range.start.line + 1;
	const end = item.range.end.line + 1;
	return `${file}#L${start}-L${end}`;
}

export async function getOutgoingAndIncomingCalls(
	mark: Mark,
	workspaceFolder: vscode.Uri,
): Promise<{
	outgoing: Set<string>;
	incoming: Set<string>;
}> {
	const outgoing = new Set<string>();
	const incoming = new Set<string>();

	const fileUri = vscode.Uri.joinPath(workspaceFolder, mark.file);

	try {
		let pos: vscode.Position;
		if (mark.symbol) {
			const symbol = await Symbol.findSymbolByName(fileUri, mark.symbol);
			if (!symbol) {
				log(`getOutgoingAndIncomingCalls: symbol '${mark.symbol}' not found`);
				return { outgoing, incoming };
			}
			pos = symbol.selectionRange.start;
		} else {
			pos = new vscode.Position(mark.startLine - 1, 0);
		}

		log(
			`getOutgoingAndIncomingCalls: preparing call hierarchy for ${fileUri.fsPath} L${pos.line + 1}`,
		);
		const items = await vscode.commands.executeCommand<
			vscode.CallHierarchyItem[]
		>('vscode.prepareCallHierarchy', fileUri, pos);
		if (!items?.length) {
			log('getOutgoingAndIncomingCalls: prepareCallHierarchy returned empty');
			return { outgoing, incoming };
		}
		const item = items[0];
		log(
			`getOutgoingAndIncomingCalls: prepared call hierarchy for name=${item.name} detail=${item.detail} kind=${item.kind}`,
		);

		const wsRoot = workspaceFolder.fsPath;

		log(`getOutgoingAndIncomingCalls: getting outgoing calls`);
		const outgoingCalls = await vscode.commands.executeCommand<
			vscode.CallHierarchyOutgoingCall[]
		>('vscode.provideOutgoingCalls', item);
		for (const call of outgoingCalls ?? []) {
			log(
				`getOutgoingAndIncomingCalls: outgoing item (name=${call.to.name} detail=${call.to.detail} kind=${call.to.kind})`,
			);
			outgoing.add(callItemToNameKey(wsRoot, call.to));
			outgoing.add(callItemToRangeKey(wsRoot, call.to));
		}

		log(`getOutgoingAndIncomingCalls: getting incoming calls`);
		const incomingCalls = await vscode.commands.executeCommand<
			vscode.CallHierarchyIncomingCall[]
		>('vscode.provideIncomingCalls', item);
		for (const call of incomingCalls ?? []) {
			log(
				`getOutgoingAndIncomingCalls: incoming item (name=${call.from.name} detail=${call.from.detail} kind=${call.from.kind})`,
			);
			incoming.add(callItemToNameKey(wsRoot, call.from));
			incoming.add(callItemToRangeKey(wsRoot, call.from));
		}
		log(
			`getOutgoingAndIncomingCalls: ${outgoing.size} outgoing items, ${incoming.size} incoming items`,
		);
	} catch (e) {
		log(`getOutgoingAndIncomingCalls: error ${e}`);
	}

	return { outgoing, incoming };
}

interface LinkSuggestion {
	mark: Mark;
	direction: 'uses' | 'usedBy';
	description: string;
	suggested: boolean;
}

export function markToKeys(mark: Mark): string[] {
	const rangeKey = `${mark.file}#L${mark.startLine}-L${mark.endLine}`;
	if (!mark.symbol) {
		return [rangeKey];
	}
	const lastSegment = mark.symbol.split('.').pop()!;
	return [`${mark.file}#${lastSegment}`, rangeKey];
}

export function markToDescription(mark: Mark): string {
	if (!mark.symbol) {
		return `${mark.file}#L${mark.startLine}-L${mark.endLine}`;
	}
	return `${mark.symbol} (${mark.file})`;
}

export function getLinkSuggestions(
	marks: Mark[],
	outgoing: Set<string>,
	incoming: Set<string>,
): LinkSuggestion[] {
	const suggestions: LinkSuggestion[] = [];

	for (const mark of marks) {
		const keys = markToKeys(mark);
		const desc = markToDescription(mark);
		const isOutgoing = keys.some((k) => outgoing.has(k));
		const isIncoming = keys.some((k) => incoming.has(k));
		log(
			`getLinkSuggestions: checking mark ${mark.id} keys=[${keys.join(', ')}]`,
		);
		if (isOutgoing) {
			suggestions.push({
				mark,
				direction: 'uses',
				description: desc,
				suggested: true,
			});
		}
		if (isIncoming) {
			suggestions.push({
				mark,
				direction: 'usedBy',
				description: desc,
				suggested: true,
			});
		}
		if (!isOutgoing && !isIncoming) {
			suggestions.push({
				mark,
				direction: 'uses',
				description: desc,
				suggested: false,
			});
		}
	}

	const suggestedCount = suggestions.filter((s) => s.suggested).length;
	log(
		`getLinkSuggestions: ${suggestions.length} items (${suggestedCount} suggested)`,
	);
	return suggestions;
}

interface QuickPickLinkItem extends vscode.QuickPickItem {
	mark: Mark;
	direction: 'uses' | 'usedBy';
	suggested: boolean;
}

export function linkSuggestionsToQuickPickItems(
	suggestions: LinkSuggestion[],
): QuickPickLinkItem[] {
	const items: QuickPickLinkItem[] = [];
	const suggested = suggestions.filter((s) => s.suggested);
	const others = suggestions.filter((s) => !s.suggested);

	for (const s of suggested) {
		items.push({
			label: `${s.direction === 'uses' ? '$(arrow-right)' : '$(arrow-left)'} ${s.description}`,
			description: s.mark.id,
			detail: 'Suggested',
			mark: s.mark,
			direction: s.direction,
			suggested: true,
		});
	}

	if (others.length > 0) {
		items.push({
			label: '',
			kind: vscode.QuickPickItemKind.Separator,
		} as any);

		for (const o of others) {
			items.push({
				label: o.description,
				description: o.mark.id,
				mark: o.mark,
				direction: o.direction,
				suggested: false,
			});
		}
	}

	return items;
}

export async function promptAndLink(mark: Mark): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (!workspaceFolder) {
		log(`promptAndLink: no workspace folder found`);
		return;
	}

	const currentMarkId = mark.id;
	const marks = (await getMarks()).filter((m) => m.id !== currentMarkId);
	if (marks.length === 0) {
		log('promptAndLink: no other marks found');
		return;
	}

	const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
		mark,
		workspaceFolder,
	);
	const linkSuggestions = getLinkSuggestions(marks, outgoing, incoming);
	const items = linkSuggestionsToQuickPickItems(linkSuggestions);
	if (items.length === 0) {
		return;
	}

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select a mark to link',
	});
	if (!selected) {
		return;
	}

	// For non-suggested items, ask direction
	let direction = selected.direction;
	if (!selected.suggested) {
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
			{ placeHolder: 'Select link direction' },
		);
		if (!dirChoice) {
			return;
		}
		direction = dirChoice.value;
	}

	const selectedMark = await Mark.fromFile(`${OUTPUT_DIR}/${selected.mark.id}`);
	if (!selectedMark) {
		return;
	}
	const reverse = direction === 'uses' ? 'usedBy' : 'uses';

	await mark.addLink(direction, selected.mark.id);
	await selectedMark.addLink(reverse, currentMarkId);
	log(
		`promptAndLink: linked ${currentMarkId} ${direction} ${selected.mark.id}`,
	);

	vscode.window.showInformationMessage(
		`Linked: ${currentMarkId} ${direction === 'uses' ? '→' : '←'} ${selected.mark.id}`,
	);
}
