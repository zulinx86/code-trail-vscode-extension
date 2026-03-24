import * as vscode from 'vscode';

const ALLOWED_KINDS = [
	vscode.SymbolKind.Function,
	vscode.SymbolKind.Method,
	vscode.SymbolKind.Constructor,
	vscode.SymbolKind.Class,
	vscode.SymbolKind.Struct,
	vscode.SymbolKind.Enum,
	vscode.SymbolKind.Interface,
];

export interface SymbolInfo {
	range: vscode.Range;
	name: string;
}

export async function getSymbolAtPosition(
	uri: vscode.Uri,
	position: vscode.Position,
): Promise<SymbolInfo | undefined> {
	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		'vscode.executeDocumentSymbolProvider',
		uri,
	);
	if (!symbols) {
		return undefined;
	}
	return findSymbolAtPosition(symbols, position);
}

function findSymbolAtPosition(
	symbols: vscode.DocumentSymbol[],
	position: vscode.Position,
	prefix = '',
): SymbolInfo | undefined {
	for (const symbol of symbols) {
		if (!symbol.range.contains(position)) {
			continue;
		}

		// Symbol found at position
		const qualifiedName = prefix ? `${prefix}.${symbol.name}` : symbol.name;

		// Search children first to get the innermost.
		const child = findSymbolAtPosition(
			symbol.children,
			position,
			qualifiedName,
		);
		if (child) {
			return child;
		}

		// The innermost one reaches here.
		if (ALLOWED_KINDS.includes(symbol.kind)) {
			return { range: symbol.range, name: qualifiedName };
		}
	}
	// No children or no symbol found at position
	return undefined;
}

export async function getSymbolPos(
	uri: vscode.Uri,
	symbolName: string,
): Promise<vscode.Position | undefined> {
	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		'vscode.executeDocumentSymbolProvider',
		uri,
	);
	if (!symbols) {
		return undefined;
	}
	return findSymbolByName(symbols, symbolName)?.selectionRange.start;
}

function findSymbolByName(
	symbols: vscode.DocumentSymbol[],
	name: string,
	prefix = '',
): vscode.DocumentSymbol | undefined {
	for (const s of symbols) {
		const qualifiedName = prefix ? `${prefix}.${s.name}` : s.name;

		// Symbol found.
		if (qualifiedName === name) {
			return s;
		}

		// Go down to children only if this symbol could be a prefix of the target
		if (name.startsWith(qualifiedName + '.')) {
			const child = findSymbolByName(s.children, name, qualifiedName);
			if (child) {
				return child;
			}
		}
	}
	return undefined;
}
