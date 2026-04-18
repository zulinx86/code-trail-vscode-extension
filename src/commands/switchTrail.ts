import * as vscode from 'vscode';
import { log } from '../utils/logger';
import { Trail } from '../utils/trail';

export async function switchTrail(): Promise<void> {
	log('switchTrail: started');

	const trails = Trail.list();
	if (trails.length === 0) {
		vscode.window.showWarningMessage(
			'No trails found. Use "Code Trail: New Trail" to create one.',
		);
		return;
	}

	const current = Trail.active();
	const items = trails.map((name) => ({
		label: name === current ? `$(check) ${name}` : name,
		description: name === current ? 'active' : undefined,
		trailName: name,
	}));

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select a trail to switch to',
	});
	if (!selected) {
		log('switchTrail: selection dismissed');
		return;
	}

	if (selected.trailName === current) {
		log('switchTrail: already on selected trail');
		return;
	}

	try {
		Trail.switch(selected.trailName);
		log(`switchTrail: switched to "${selected.trailName}"`);
		vscode.window.showInformationMessage(
			`Code Trail: Switched to trail "${selected.trailName}"`,
		);
	} catch (e) {
		log(`switchTrail: error: ${e}`);
		vscode.window.showErrorMessage(`Failed to switch trail: ${e}`);
	}
}
