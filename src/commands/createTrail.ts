import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { Trail } from '../utils/trail';

export async function createTrail(): Promise<void> {
	log('createTrail: started');

	const name = await vscode.window.showInputBox({
		prompt: 'Enter a name for the new trail',
		placeHolder: 'e.g. initialization-flow',
		validateInput: (value) => {
			if (!value.trim()) {
				return 'Trail name cannot be empty';
			}
			if (!/^[a-zA-Z0-9 _-]+$/.test(value)) {
				return 'Trail name can only contain letters, numbers, spaces, hyphens, and underscores';
			}
			if (Trail.list().includes(value)) {
				return `Trail "${value}" already exists`;
			}
			return undefined;
		},
	});
	if (!name) {
		log('createTrail: input dismissed');
		return;
	}

	try {
		Trail.create(name);
		log(`createTrail: created and switched to "${name}"`);
		vscode.window.showInformationMessage(
			`Code Trail: Created and switched to trail "${name}"`,
		);
	} catch (e) {
		log(`createTrail: error: ${e}`);
		vscode.window.showErrorMessage(`Failed to create trail: ${e}`);
	}
}
