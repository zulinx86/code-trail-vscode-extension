import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	getOutgoingAndIncomingCalls,
	getLinkSuggestions,
} from '../../../utils/link';
import { Selection } from '../../../utils/selection';
import { Mark, getMarks } from '../../../utils/mark';
import {
	openFixture,
	waitForSymbols,
	waitForCallHierarchy,
} from '../../helpers';

suite('link (Rust)', () => {
	const workspaceUri = vscode.workspace.workspaceFolders![0].uri;
	const outputDir = vscode.Uri.joinPath(workspaceUri, 'code-trail');

	async function cleanup() {
		try {
			await vscode.workspace.fs.delete(outputDir, { recursive: true });
		} catch {}
	}

	setup(cleanup);
	teardown(cleanup);

	suite('getOutgoingAndIncomingCalls', () => {
		test('should detect outgoing calls', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			// L34: fn my_caller
			await waitForCallHierarchy(doc.uri, new vscode.Position(33, 0));

			const mark = new Mark({
				file: 'src/test/fixtures/rust/src/lib.rs',
				startLine: 34,
				endLine: 36,
				symbol: 'my_caller',
				link: 'code-trail:src/test/fixtures/rust/src/lib.rs#L34-L36',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const { outgoing } = await getOutgoingAndIncomingCalls(
				mark,
				workspaceUri,
			);
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

			const mark = new Mark({
				file: 'src/test/fixtures/rust/src/lib.rs',
				startLine: 30,
				endLine: 32,
				symbol: 'my_callee',
				link: 'code-trail:src/test/fixtures/rust/src/lib.rs#L30-L32',
				exportedAt: new Date('2026-01-01T00:00:00Z'),
			});
			const { incoming } = await getOutgoingAndIncomingCalls(
				mark,
				workspaceUri,
			);
			const keys = [...incoming];
			assert.ok(
				keys.some((k) => k.includes('my_caller')),
				`incoming should contain my_caller, got: [${keys.join(', ')}]`,
			);
		});
	});

	suite('getLinkSuggestions', () => {
		async function saveMarkAtPosition(
			doc: vscode.TextDocument,
			position: vscode.Position,
		): Promise<Mark> {
			const editor = await vscode.window.showTextDocument(doc);
			editor.selection = new vscode.Selection(position, position);
			const sel = await Selection.fromEditor(editor);
			assert.ok(sel, 'selection should be created');
			const mark = Mark.fromSelection(sel, new Date());
			await mark.save();
			return mark;
		}

		test('should suggest impl method callee as outgoing', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			await waitForCallHierarchy(doc.uri, new vscode.Position(44, 7));

			// L45: fn my_impl_caller of impl MyImplCall
			const callerMark = await saveMarkAtPosition(
				doc,
				new vscode.Position(45, 8),
			);
			// L41: fn my_impl_callee of impl MyImplCall
			const calleeMark = await saveMarkAtPosition(
				doc,
				new vscode.Position(41, 8),
			);

			const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
				callerMark,
				workspaceUri,
			);
			const marks = await getMarks();
			const suggestions = getLinkSuggestions(marks, outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);

			const calleeMarkId = calleeMark.id;
			assert.ok(
				suggested.some(
					(s) => s.mark.markId === calleeMarkId && s.direction === 'uses',
				),
				'should suggest my_impl_callee as uses',
			);
		});

		test('should suggest impl method caller as incoming', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			await waitForCallHierarchy(doc.uri, new vscode.Position(40, 7));

			// L41: fn my_impl_callee of impl MyImplCall
			const calleeMark = await saveMarkAtPosition(
				doc,
				new vscode.Position(41, 8),
			);
			// L45: fn my_impl_caller of impl MyImplCall
			const callerMark = await saveMarkAtPosition(
				doc,
				new vscode.Position(45, 8),
			);

			const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
				calleeMark,
				workspaceUri,
			);
			const marks = await getMarks();
			const suggestions = getLinkSuggestions(marks, outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);

			const callerMarkId = callerMark.id;
			assert.ok(
				suggested.some(
					(s) => s.mark.markId === callerMarkId && s.direction === 'usedBy',
				),
				'should suggest my_impl_caller as usedBy',
			);
		});
	});
});
