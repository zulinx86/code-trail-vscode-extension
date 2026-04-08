import * as path from 'path';
import * as vscode from 'vscode';
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

		const { outgoing, incoming } = await this.getCalls(marks);
		const suggestions = this.getSuggestions(marks, outgoing, incoming);
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

		// For non-suggested item, ask direction
		if (!selected.direction) {
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
			selected.direction = dirChoice.value;
		}
		const reverse = selected.direction === 'uses' ? 'usedBy' : 'uses';
		await this.mark.connect(selected.direction, selected.mark.id);
		await selected.mark.connect(reverse, this.mark.id);
		log(
			`Connect.prompt: linked ${currentMarkId} ${selected.direction} ${selected.mark.id}`,
		);
		vscode.window.showInformationMessage(
			`Linked: ${currentMarkId} ${selected.direction === 'uses' ? '->' : '<-'} ${selected.mark.id}`,
		);
	}

	async getCalls(candidateMarks: Mark[]): Promise<{
		outgoing: Set<string>;
		incoming: Set<string>;
	}> {
		const outgoing = await this.getOutgoing(candidateMarks);
		const incoming = new Set<string>();

		// TODO: Task 3 - Reference Provider incoming detection

		log(
			`Connect.getCalls: outgoing=[${[...outgoing].join(', ')}] incoming=[${[...incoming].join(', ')}]`,
		);
		return { outgoing, incoming };
	}

	/**
	 * Scans code text for word-boundary matches of candidate symbol names.
	 * Returns a map from symbol name to the 0-based character offset of the first occurrence.
	 */
	static scanForSymbols(
		codeString: string,
		candidateSymbols: string[],
	): Map<string, number> {
		const result = new Map<string, number>();
		for (const symbol of candidateSymbols) {
			// Use \b (word boundary) to match whole symbols only.
			// \b matches the boundary between a word char [a-zA-Z0-9_] and a non-word char.
			// e.g. \bread\b matches "read(buf)" but not "readFile" or "__kvm_read".
			const regex = new RegExp(`\\b${symbol}\\b`);
			const match = regex.exec(codeString);
			if (match) {
				result.set(symbol, match.index);
			}
		}
		return result;
	}

	/**
	 * Detects outgoing calls by scanning the current mark's code for other marks'
	 * symbol names, then verifying each match with the Definition Provider.
	 */
	private async getOutgoing(candidateMarks: Mark[]): Promise<Set<string>> {
		const outgoing = new Set<string>();
		const codeString = this.mark.code;
		if (!codeString) return outgoing;

		// Build a map from last segment of symbol name to candidate marks.
		// Multiple marks can share the same symbol name (e.g. init() in different files).
		const symbolToMarks = new Map<string, Mark[]>();
		for (const m of candidateMarks) {
			if (!m.symbol) continue;
			const lastSegment = m.symbol.split('.').pop()!;
			const existing = symbolToMarks.get(lastSegment) ?? [];
			existing.push(m);
			symbolToMarks.set(lastSegment, existing);
		}

		const matches = Connect.scanForSymbols(codeString, [...symbolToMarks.keys()]);
		log(
			`Connect.getOutgoing: text scan found [${[...matches.keys()].join(', ')}]`,
		);

		// Verify each match with Definition Provider in parallel
		const uri = vscode.Uri.joinPath(workspaceFolder!.uri, this.mark.file);
		const verifications = [...matches.entries()].map(
			async ([symbolName, charOffset]) => {
				try {
					// Convert character offset in the code string to a position in the source file
					const codeBeforeMatch = codeString.substring(0, charOffset);
					const linesBeforeMatch = codeBeforeMatch.split('\n');
					const lineOffset = linesBeforeMatch.length - 1;
					const charPos =
						linesBeforeMatch[linesBeforeMatch.length - 1].length;
					const pos = new vscode.Position(
						this.mark.startLine - 1 + lineOffset,
						charPos,
					);

					const definitions = await vscode.commands.executeCommand<
						vscode.Location[]
					>('vscode.executeDefinitionProvider', uri, pos);
					if (!definitions?.length) {
						log(
							`Connect.getOutgoing: no definition for ${symbolName} at L${pos.line + 1}`,
						);
						return;
					}

					// Check each candidate mark with the same symbol name
					for (const candidateMark of symbolToMarks.get(symbolName)!) {
						const candidateFile = path.resolve(
							workspaceFolder!.uri.fsPath,
							candidateMark.file,
						);
						const match = definitions.some(
							(def) => def.uri.fsPath === candidateFile,
						);
						if (match) {
							const helper = new MarkHelper(candidateMark);
							for (const key of helper.keys) {
								outgoing.add(key);
							}
							log(
								`Connect.getOutgoing: verified ${symbolName} -> ${candidateMark.id}`,
							);
						}
					}
				} catch (e) {
					log(
						`Connect.getOutgoing: definition provider error for ${symbolName}: ${e}`,
					);
				}
			},
		);
		await Promise.all(verifications);

		return outgoing;
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
						direction: undefined,
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
	direction?: 'uses' | 'usedBy';
	description: string;
	suggested: boolean;
}

export class ConnectSuggestion {
	readonly mark: Mark;
	readonly direction?: 'uses' | 'usedBy';
	readonly description: string;
	readonly suggested: boolean;

	constructor(args: ConnectSuggestionArgs) {
		this.mark = args.mark;
		this.direction = args.direction;
		this.description = args.description;
		this.suggested = args.suggested;
	}

	toQuickPickItem(): ConnectQuickPickItem {
		const icon = this.suggested
			? this.direction === 'uses'
				? '$(arrow-right)'
				: '$(arrow-left)'
			: '$(circle-filled)';
		return {
			label: `${icon} ${this.description}`,
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
	direction?: 'uses' | 'usedBy';
	readonly suggested: boolean;
}
