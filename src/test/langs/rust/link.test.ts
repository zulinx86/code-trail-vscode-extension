import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	getOutgoingAndIncomingCalls,
	getLinkSuggestions,
	markToKeys,
} from '../../../utils/link';
import { Symbol } from '../../../utils/symbol';
import { buildSelectionInfo } from '../../../utils/selection';
import { saveMark, getMarks } from '../../../utils/mark';
import { parseFrontmatter, type Frontmatter } from '../../../utils/frontmatter';
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

	suite('getLinkSuggestions', () => {
		async function saveMarkAtPosition(
			doc: vscode.TextDocument,
			position: vscode.Position,
		): Promise<vscode.Uri> {
			const symbol = await Symbol.findSymbolAtPosition(doc.uri, position);
			assert.ok(symbol, `should find symbol at L${position.line + 1}`);
			const info = buildSelectionInfo(doc, symbol.range, symbol);
			return saveMark(info, new Date());
		}

		test('should suggest impl method callee as outgoing', async function () {
			const doc = await openFixture('rust/src/lib.rs');
			await waitForSymbols(doc.uri);
			await waitForCallHierarchy(doc.uri, new vscode.Position(44, 7));

			// L45: fn my_impl_caller of impl MyImplCall
			const callerUri = await saveMarkAtPosition(
				doc,
				new vscode.Position(45, 8),
			);
			// L41: fn my_impl_callee of impl MyImplCall
			const calleeUri = await saveMarkAtPosition(
				doc,
				new vscode.Position(41, 8),
			);

			const callerContent = Buffer.from(
				await vscode.workspace.fs.readFile(callerUri),
			).toString('utf-8');
			const callerFm = parseFrontmatter(callerContent)!;

			const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
				callerFm,
				workspaceUri,
			);
			const marks = await getMarks();
			const suggestions = getLinkSuggestions(marks, outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);

			const calleeMarkId = calleeUri.fsPath.split('/').pop()!;
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
			const calleeUri = await saveMarkAtPosition(
				doc,
				new vscode.Position(41, 8),
			);
			// L45: fn my_impl_caller of impl MyImplCall
			const callerUri = await saveMarkAtPosition(
				doc,
				new vscode.Position(45, 8),
			);

			const calleeContent = Buffer.from(
				await vscode.workspace.fs.readFile(calleeUri),
			).toString('utf-8');
			const calleeFm = parseFrontmatter(calleeContent)!;

			const { outgoing, incoming } = await getOutgoingAndIncomingCalls(
				calleeFm,
				workspaceUri,
			);
			const marks = await getMarks();
			const suggestions = getLinkSuggestions(marks, outgoing, incoming);
			const suggested = suggestions.filter((s) => s.suggested);

			const callerMarkId = callerUri.fsPath.split('/').pop()!;
			assert.ok(
				suggested.some(
					(s) => s.mark.markId === callerMarkId && s.direction === 'usedBy',
				),
				'should suggest my_impl_caller as usedBy',
			);
		});
	});
});
