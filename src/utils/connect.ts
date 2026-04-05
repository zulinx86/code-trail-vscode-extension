import * as path from 'path';
import * as vscode from 'vscode';
import { Symbol } from './symbol';
import { Mark } from './mark';
import { log } from './logger';
import { workspaceFolder } from '../config';

export class Connect {
	constructor(readonly mark: Mark) {}

	async prompt(): Promise<void> {
		const currentMarkId = this.mark.id;
		const marks = (await Mark.getAll()).filter((m) => m.id !== currentMarkId);
		if (marks.length === 0) {
			log(`Connect.prompt: no other marks found`);
			return;
		}

		const { incoming, outgoing } = await this.getCalls();
		const suggestions = this.getSuggestions(marks, incoming, outgoing);
		const quickPickItems = new ConnectSuggestions(
			suggestions,
		).toQuickPickItems();
		const selected = await vscode.window.showQuickPick(quickPickItems, {
			placeHolder: 'Select a mark to connect',
		});
		if (!selected) {
			log(`Connect.prompt: no mark selected`);
			return;
		}

		let direction = selected.direction;
		// For non-suggested item, ask direction
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
				{ placeHolder: 'Select connection direction' },
			);
			if (!dirChoice) {
				log(`Connect.prompt: no direction selected`);
				return;
			}
			direction = dirChoice.value;
		}
		const reverse = direction === 'uses' ? 'usedBy' : 'uses';
		await this.mark.connect(direction, selected.mark.id);
		await selected.mark.connect(reverse, this.mark.id);
		log(
			`Connect.prompt: linked ${currentMarkId} ${direction} ${selected.mark.id}`,
		);
		vscode.window.showInformationMessage(
			`Linked: ${currentMarkId} ${direction === 'uses' ? '→' : '←'} ${selected.mark.id}`,
		);
	}

	async getCalls(): Promise<{
		outgoing: Set<string>;
		incoming: Set<string>;
	}> {
		const outgoing = new Set<string>();
		const incoming = new Set<string>();

		const uri = vscode.Uri.joinPath(workspaceFolder!.uri, this.mark.file);

		try {
			// Get position
			let pos: vscode.Position;
			if (this.mark.symbol) {
				const symbol = await Symbol.findSymbolByName(uri, this.mark.symbol);
				if (!symbol) {
					log(`Connect.getCalls: symbol '${this.mark.symbol}' not found`);
					return { outgoing, incoming };
				}
				pos = symbol.selectionRange.start;
			} else {
				pos = new vscode.Position(this.mark.startLine - 1, 0);
			}

			// Prepare call hierarchy for provideIncomingCalls and provideOutgoingCalls
			log(
				`Connect.getCalls: preparing call hierarchy for ${uri.fsPath}#L${pos.line + 1}`,
			);
			const items = await vscode.commands.executeCommand<
				vscode.CallHierarchyItem[]
			>('vscode.prepareCallHierarchy', uri, pos);
			if (!items?.length) {
				log('Connect.getCalls: prepareCallHierarchy returned empty');
				return { outgoing, incoming };
			}
			const query = items[0];
			log(`Connect.getCalls: prepared call hierarchy for ${query.name}`);

			// Get outgoing calls
			const outgoingCalls = await vscode.commands.executeCommand<
				vscode.CallHierarchyOutgoingCall[]
			>('vscode.provideOutgoingCalls', query);
			for (const call of outgoingCalls ?? []) {
				log(`Connect.getCalls: outgoing item ${call.to.name}`);
				const item = new CallItem(call.to);
				outgoing.add(item.nameKey);
				outgoing.add(item.rangeKey);
			}

			// Get incoming calls
			log(`Connect.getCalls: getting incoming calls`);
			const incomingCalls = await vscode.commands.executeCommand<
				vscode.CallHierarchyIncomingCall[]
			>('vscode.provideIncomingCalls', query);
			for (const call of incomingCalls ?? []) {
				log(`Connect.getCalls: incoming item ${call.from.name}`);
				const item = new CallItem(call.from);
				incoming.add(item.nameKey);
				incoming.add(item.rangeKey);
			}
		} catch (e) {
			log(`Connect.getCalls: error ${e}`);
		}

		log(
			`Connect.getCalls: ${incoming.size} incoming items, ${outgoing.size} outgoing items`,
		);
		return { outgoing, incoming };
	}

	getSuggestions(
		marks: Mark[],
		outgoing: Set<string>,
		incoming: Set<string>,
	): ConnectSuggestion[] {
		const suggestions: ConnectSuggestion[] = [];

		for (const mark of marks) {
			const helper = new MarkHelper(mark);
			const keys = helper.keys;
			const desc = helper.description;
			log(`getSuggestions: checking mark ${mark.id} keys=[${keys.join(', ')}]`);

			const isIncoming = keys.some((k) => incoming.has(k));
			if (isIncoming) {
				suggestions.push(
					new ConnectSuggestion({
						mark,
						direction: 'usedBy',
						description: desc,
						suggested: true,
					}),
				);
			}

			const isOutgoing = keys.some((k) => outgoing.has(k));
			if (isOutgoing) {
				suggestions.push(
					new ConnectSuggestion({
						mark,
						direction: 'uses',
						description: desc,
						suggested: true,
					}),
				);
			}

			if (!isIncoming && !isOutgoing) {
				suggestions.push(
					new ConnectSuggestion({
						mark,
						direction: 'uses',
						description: desc,
						suggested: false,
					}),
				);
			}
		}

		const suggestedCount = suggestions.filter((s) => s.suggested).length;
		log(
			`Connect.getSuggestions: ${suggestions.length} items (${suggestedCount} suggested)`,
		);
		return suggestions;
	}
}

export class CallItem {
	constructor(readonly item: vscode.CallHierarchyItem) {}

	get nameKey() {
		const file = path.relative(
			workspaceFolder!.uri.fsPath,
			this.item.uri.fsPath,
		);
		return `${file}#${this.item.name}`;
	}

	get rangeKey() {
		const file = path.relative(
			workspaceFolder!.uri.fsPath,
			this.item.uri.fsPath,
		);
		const start = this.item.range.start.line + 1;
		const end = this.item.range.end.line + 1;
		return `${file}#L${start}-L${end}`;
	}
}

export class MarkHelper {
	constructor(private mark: Mark) {}

	get keys(): string[] {
		const rangeKey = `${this.mark.file}#L${this.mark.startLine}-L${this.mark.endLine}`;
		if (!this.mark.symbol) {
			return [rangeKey];
		}
		const lastSegment = this.mark.symbol.split('.').pop()!;
		return [`${this.mark.file}#${lastSegment}`, rangeKey];
	}

	get description(): string {
		if (!this.mark.symbol) {
			return `${this.mark.file}#L${this.mark.startLine}-L${this.mark.endLine}`;
		}
		return `${this.mark.symbol} (${this.mark.file})`;
	}
}

interface ConnectSuggestionArgs {
	mark: Mark;
	direction: 'uses' | 'usedBy';
	description: string;
	suggested: boolean;
}

export class ConnectSuggestion {
	readonly mark: Mark;
	readonly direction: 'uses' | 'usedBy';
	readonly description: string;
	readonly suggested: boolean;

	constructor(args: ConnectSuggestionArgs) {
		this.mark = args.mark;
		this.direction = args.direction;
		this.description = args.description;
		this.suggested = args.suggested;
	}

	toQuickPickItem(): ConnectQuickPickItem {
		return {
			label: `${this.direction === 'uses' ? '$(arrow-right)' : '$(arrow-left)'} ${this.description}`,
			description: this.mark.id,
			detail: this.suggested ? 'Suggested' : undefined,
			mark: this.mark,
			direction: this.direction,
			suggested: this.suggested,
		};
	}
}

export class ConnectSuggestions {
	constructor(private suggestions: ConnectSuggestion[]) {}

	toQuickPickItems(): ConnectQuickPickItem[] {
		return [
			...this.suggestions
				.filter((s) => s.suggested)
				.map((s) => s.toQuickPickItem()),
			...this.suggestions
				.filter((s) => !s.suggested)
				.map((s) => s.toQuickPickItem()),
		];
	}
}

interface ConnectQuickPickItem extends vscode.QuickPickItem {
	readonly mark: Mark;
	readonly direction: 'uses' | 'usedBy';
	readonly suggested: boolean;
}
