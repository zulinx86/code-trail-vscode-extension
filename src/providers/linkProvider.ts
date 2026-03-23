import * as vscode from 'vscode';

const LINK_PATTERN = /code-atlas:([^#\s)]+)#L(\d+)-L(\d+)/g;

export class CodeAtlasLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
		const links: vscode.DocumentLink[] = [];
		const text = document.getText();

		let match: RegExpExecArray | null;
		while ((match = LINK_PATTERN.exec(text)) !== null) {
			const filePath = match[1];
			const startLine = parseInt(match[2], 10);
			const endLine = parseInt(match[3], 10);

			// link covers the entire (code-atlas:...) portion
			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[0].length);
			const range = new vscode.Range(startPos, endPos);

			const args = encodeURIComponent(
				JSON.stringify({ filePath, startLine, endLine }),
			);
			const commandUri = vscode.Uri.parse(`command:codeAtlas.openLink?${args}`);
			links.push(new vscode.DocumentLink(range, commandUri));
		}

		return links;
	}
}
