import * as vscode from 'vscode';

const OUTPUT_DIR = 'code-atlas';

export async function saveFile(
	fileName: string,
	content: string,
): Promise<vscode.Uri> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('No workspace folder found.');
	}

	const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, OUTPUT_DIR);
	await vscode.workspace.fs.createDirectory(dirUri);

	const fileUri = vscode.Uri.joinPath(dirUri, fileName);
	await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
	return fileUri;
}
