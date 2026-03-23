import * as vscode from 'vscode';
import * as path from 'path';
import {
	parseFrontmatter,
	addLink,
	type Frontmatter,
} from '../utils/frontmatter';
import { getSymbolRange } from '../utils/symbol';

const OUTPUT_DIR = 'code-atlas';

interface BookmarkInfo {
	bookmarkId: string;
	uri: vscode.Uri;
	fm: Frontmatter;
}

async function getBookmarks(): Promise<BookmarkInfo[]> {
	const files = await vscode.workspace.findFiles(`${OUTPUT_DIR}/*.md`);
	const bookmarks: BookmarkInfo[] = [];
	for (const uri of files) {
		const content = Buffer.from(
			await vscode.workspace.fs.readFile(uri),
		).toString('utf-8');
		const fm = parseFrontmatter(content);
		if (fm) {
			bookmarks.push({
				bookmarkId: path.basename(uri.fsPath),
				uri,
				fm,
			});
		}
	}
	return bookmarks;
}

function bookmarkToKey(b: BookmarkInfo): string {
	return b.fm.symbol
		? `${b.fm.file}#${b.fm.symbol}`
		: `${b.fm.file}#L${b.fm.startLine}-L${b.fm.endLine}`;
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
			const range = await getSymbolRange(fileUri, fm.symbol);
			if (!range) {
				return { outgoing, incoming };
			}
			pos = range.start;
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

		// Get ongoing calls
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
	bookmark: BookmarkInfo;
	direction: 'uses' | 'usedBy';
}

export async function linkBookmark(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor found.');
		return;
	}

	const currentFm = parseFrontmatter(editor.document.getText());
	if (!currentFm) {
		vscode.window.showWarningMessage('Current file is not a valid bookmark.');
		return;
	}

	// Get all the bookmarks
	const currentBookmarkId = path.basename(editor.document.uri.fsPath);
	const bookmarks = (await getBookmarks()).filter(
		(b) => b.bookmarkId !== currentBookmarkId,
	);
	if (bookmarks.length === 0) {
		vscode.window.showWarningMessage('No other bookmarks found.');
		return;
	}

	// Get ongoing and incoming calls
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

	for (const b of bookmarks) {
		const key = bookmarkToKey(b);
		const isOutgoing = outgoing.has(key);
		const isIncoming = incoming.has(key);

		const desc = `${b.fm.file}${b.fm.symbol ? ' · ' + b.fm.symbol : ''}`;

		if (isOutgoing) {
			items.push({
				label: `$(arrow-right) ${desc}`,
				description: b.bookmarkId,
				detail: 'Suggested',
				bookmark: b,
				direction: 'uses',
			});
		}
		if (isIncoming) {
			items.push({
				label: `$(arrow-left) ${desc}`,
				description: b.bookmarkId,
				detail: 'Suggested',
				bookmark: b,
				direction: 'usedBy',
			});
		}
		if (!isOutgoing && !isIncoming) {
			others.push({
				label: desc,
				description: b.bookmarkId,
				bookmark: b,
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
		placeHolder: 'Select a bookmark to link',
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
	const targetUri = selected.bookmark.uri;
	const targetBookmarkId = selected.bookmark.bookmarkId;
	const reverseDirection = direction === 'uses' ? 'usedBy' : 'uses';

	// Add links
	await addLink(currentUri, direction, targetBookmarkId);
	await addLink(targetUri, reverseDirection, currentBookmarkId);

	vscode.window.showInformationMessage(
		`Linked: ${currentBookmarkId} ${direction === 'uses' ? '→' : '←'} ${targetBookmarkId}`,
	);
}
