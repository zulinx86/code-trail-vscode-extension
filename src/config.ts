import * as vscode from 'vscode';

export const OUTPUT_DIR = 'code-trail';
export const TRAILS_DIR = '.code-trail/trails';

export const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
