import * as assert from 'assert';
import * as vscode from 'vscode';
import { getOutgoingAndIncomingCalls } from '../../../utils/link';
import {
	openFixture,
	waitForSymbols,
	waitForCallHierarchy,
} from '../../helpers';
import type { Frontmatter } from '../../../utils/frontmatter';

suite('link (Rust)', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;

	suite('getOutgoingAndIncomingCalls', () => {
		test('should detect outgoing calls', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L34: fn my_caller
			await waitForCallHierarchy(doc.uri, new vscode.Position(33, 0));

			const fm: Frontmatter = {
				file: 'src/test/fixtures/rust/src/lib.rs',
				startLine: 34,
				endLine: 36,
				symbol: 'my_caller',
				link: 'code-trail:src/test/fixtures/rust/src/lib.rs#L34-L36',
				exportedAt: '2026-01-01T00:00:00Z',
			};
			const { outgoing } = await getOutgoingAndIncomingCalls(fm, workspaceUri);
			const keys = [...outgoing];
			assert.ok(
				keys.some((k) => k.includes('my_callee')),
				`outgoing should contain my_callee, got: [${keys.join(', ')}]`,
			);
		});

		test('should detect incoming calls', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L30: fn my_callee
			await waitForCallHierarchy(doc.uri, new vscode.Position(29, 0));

			const fm: Frontmatter = {
				file: 'src/test/fixtures/rust/src/lib.rs',
				startLine: 30,
				endLine: 32,
				symbol: 'my_callee',
				link: 'code-trail:src/test/fixtures/rust/src/lib.rs#L30-L32',
				exportedAt: '2026-01-01T00:00:00Z',
			};
			const { incoming } = await getOutgoingAndIncomingCalls(fm, workspaceUri);
			const keys = [...incoming];
			assert.ok(
				keys.some((k) => k.includes('my_caller')),
				`incoming should contain my_caller, got: [${keys.join(', ')}]`,
			);
		});
	});
});
