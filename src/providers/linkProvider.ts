import * as vscode from 'vscode';

// Matches "code-trail:<filepath>#L<start>-L<end>" links in comments.
//   Group 1: file path — greedy match of everything except '#' and whitespace.
//            Greedy ('+' not '+?') so that paths containing special characters
//            like '(' and ')' are captured in full.
//   Group 2: optional start line number
//   Group 3: optional end line number
// Examples: "code-trail:src/main.ts", "code-trail:src/main.ts#L10-L20"
//           "code-trail:notes/20260410_(title)_MSR.md"
const LINK_PATTERN = /code-trail:([^#\s]+)(?:#L(\d+)-L(\d+))?/g;

export class CodeTrailLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
		const links: vscode.DocumentLink[] = [];
		const text = document.getText();

		let match: RegExpExecArray | null;
		while ((match = LINK_PATTERN.exec(text)) !== null) {
			const file = match[1];
			const startLine = match[2] ? parseInt(match[2], 10) : undefined;
			const endLine = match[3] ? parseInt(match[3], 10) : undefined;

			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[0].length);
			const range = new vscode.Range(startPos, endPos);

			const args = encodeURIComponent(
				JSON.stringify({ file, startLine, endLine }),
			);
			const commandUri = vscode.Uri.parse(`command:codeTrail.navigate?${args}`);
			links.push(new vscode.DocumentLink(range, commandUri));
		}

		return links;
	}
}
