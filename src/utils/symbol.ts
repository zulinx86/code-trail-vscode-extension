import * as vscode from 'vscode';
import { log } from './logger';

export class Symbol {
	readonly name: string;
	readonly kind: string;
	readonly range: vscode.Range;
	readonly selectionRange: vscode.Range;

	private constructor(
		name: string,
		kind: string,
		range: vscode.Range,
		selectionRange: vscode.Range,
	) {
		this.name = name;
		this.kind = kind;
		this.range = range;
		this.selectionRange = selectionRange;
	}

	private static stringifySymbolKind(kind: vscode.SymbolKind): string {
		switch (kind) {
			case vscode.SymbolKind.Constant:
				return 'const';
			case vscode.SymbolKind.Enum:
				return 'enum';
			case vscode.SymbolKind.Function:
				return 'function';
			case vscode.SymbolKind.Struct:
				return 'struct';
			case vscode.SymbolKind.Class:
				return 'class';
			case vscode.SymbolKind.Constructor:
				return 'constructor';
			case vscode.SymbolKind.Method:
				return 'method';
			case vscode.SymbolKind.Interface:
				return 'interface';
			default:
				return 'other';
		}
	}

	static async findSymbolAtPosition(
		uri: vscode.Uri,
		position: vscode.Position,
	): Promise<Symbol | undefined> {
		log(
			`findSymbolAtPosition: uri=${uri.fsPath} position=L${position.line + 1}`,
		);

		const symbols = await vscode.commands.executeCommand<
			vscode.DocumentSymbol[]
		>('vscode.executeDocumentSymbolProvider', uri);
		if (!symbols) {
			log('findSymbolAtPosition: no symbol provider');
			return undefined;
		}
		log(
			`findSymbolAtPosition: ${symbols.length} top-level symbols found in ${uri.fsPath}`,
		);

		const symbol = this.__findSymbolAtPosition(symbols, position);
		log(`findSymbolAtPosition: symbol found (${JSON.stringify(symbol)})`);
		return symbol;
	}

	private static __findSymbolAtPosition(
		symbols: vscode.DocumentSymbol[],
		position: vscode.Position,
		prefix = '',
	): Symbol | undefined {
		for (const symbol of symbols) {
			// Skip if the symbol not contain the position.
			if (!symbol.range.contains(position)) {
				continue;
			}

			// Symbol found at position. Build a qualified name.
			const qualifiedName = prefix ? `${prefix}.${symbol.name}` : symbol.name;

			// Search children first to get the innermost.
			const child = this.__findSymbolAtPosition(
				symbol.children,
				position,
				qualifiedName,
			);

			// Return the child contains the position.
			if (child) {
				return child;
			}

			return new Symbol(
				qualifiedName,
				this.stringifySymbolKind(symbol.kind),
				symbol.range,
				symbol.selectionRange,
			);
		}
	}

	static async findSymbolByName(
		uri: vscode.Uri,
		name: string,
	): Promise<Symbol | undefined> {
		log(`findSymbolByName: uri=${uri.fsPath} name=${name}`);

		const symbols = await vscode.commands.executeCommand<
			vscode.DocumentSymbol[]
		>('vscode.executeDocumentSymbolProvider', uri);
		if (!symbols) {
			log(`findSymbolByName: no symbol provider`);
			return undefined;
		}

		const symbol = this.__findSymbolByName(symbols, name);
		log(`findSymbolByName: symbol found (${JSON.stringify(symbol)})`);
		return symbol;
	}

	private static __findSymbolByName(
		symbols: vscode.DocumentSymbol[],
		name: string,
		prefix = '',
	): Symbol | undefined {
		for (const symbol of symbols) {
			const qualifiedName = prefix ? `${prefix}.${symbol.name}` : symbol.name;

			// Symbol found.
			if (qualifiedName === name) {
				return new Symbol(
					qualifiedName,
					this.stringifySymbolKind(symbol.kind),
					symbol.range,
					symbol.selectionRange,
				);
			}

			// Go down to children only if the qualified name is a prefix.
			if (name.startsWith(qualifiedName + '.')) {
				const child = this.__findSymbolByName(
					symbol.children,
					name,
					qualifiedName,
				);
				if (child) {
					// Symbol found in children
					return child;
				}
			}
		}
		return undefined;
	}
}
