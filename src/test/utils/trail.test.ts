import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { workspaceFolder } from '../../config';
import { Trail } from '../../utils/trail';

suite('trail', () => {
	const wsRoot = workspaceFolder!.uri.fsPath;
	const trailsRoot = path.join(wsRoot, '.code-trail', 'trails');
	const outputDir = path.join(wsRoot, 'code-trail');

	function cleanup() {
		// Remove symlink
		try {
			const stat = fs.lstatSync(outputDir);
			if (stat.isSymbolicLink()) {
				fs.unlinkSync(outputDir);
			} else if (stat.isDirectory()) {
				fs.rmSync(outputDir, { recursive: true });
			} else {
				fs.unlinkSync(outputDir);
			}
		} catch {
			// Does not exist
		}

		// Remove .code-trail
		const codeTrailDir = path.join(wsRoot, '.code-trail');
		if (fs.existsSync(codeTrailDir)) {
			fs.rmSync(codeTrailDir, { recursive: true });
		}
	}

	setup(cleanup);
	teardown(cleanup);

	suite('Trail.list', () => {
		test('should return empty array when no trails exist', () => {
			assert.deepStrictEqual(Trail.list(), []);
		});

		test('should return sorted trail names', () => {
			fs.mkdirSync(path.join(trailsRoot, 'beta'), { recursive: true });
			fs.mkdirSync(path.join(trailsRoot, 'alpha'), { recursive: true });
			assert.deepStrictEqual(Trail.list(), ['alpha', 'beta']);
		});

		test('should ignore files in trails directory', () => {
			fs.mkdirSync(trailsRoot, { recursive: true });
			fs.writeFileSync(path.join(trailsRoot, 'not-a-trail.txt'), '');
			fs.mkdirSync(path.join(trailsRoot, 'real-trail'));
			assert.deepStrictEqual(Trail.list(), ['real-trail']);
		});
	});

	suite('Trail.create', () => {
		test('should create trail directory and switch to it', () => {
			fs.mkdirSync(trailsRoot, { recursive: true });
			Trail.create('my-trail');

			assert.ok(fs.existsSync(path.join(trailsRoot, 'my-trail')));
			assert.strictEqual(Trail.active(), 'my-trail');
		});

		test('should throw if trail already exists', () => {
			fs.mkdirSync(path.join(trailsRoot, 'existing'), { recursive: true });
			assert.throws(() => Trail.create('existing'), /already exists/);
		});

		test('should allow spaces in trail name', () => {
			fs.mkdirSync(trailsRoot, { recursive: true });
			Trail.create('my trail');

			assert.ok(fs.existsSync(path.join(trailsRoot, 'my trail')));
			assert.strictEqual(Trail.active(), 'my trail');
		});
	});

	suite('Trail.switch', () => {
		test('should switch symlink to target trail', () => {
			fs.mkdirSync(path.join(trailsRoot, 'first'), { recursive: true });
			fs.mkdirSync(path.join(trailsRoot, 'second'), { recursive: true });

			Trail.switch('first');
			assert.strictEqual(Trail.active(), 'first');

			Trail.switch('second');
			assert.strictEqual(Trail.active(), 'second');
		});

		test('should throw if trail does not exist', () => {
			assert.throws(() => Trail.switch('nonexistent'), /does not exist/);
		});

		test('should migrate existing directory to default trail', () => {
			// Create a plain code-trail/ directory with a file
			fs.mkdirSync(outputDir, { recursive: true });
			fs.writeFileSync(path.join(outputDir, 'mark.md'), 'test');
			fs.mkdirSync(trailsRoot, { recursive: true });
			fs.mkdirSync(path.join(trailsRoot, 'target'));

			Trail.switch('target');

			// Old file should be in default trail
			assert.ok(fs.existsSync(path.join(trailsRoot, 'default', 'mark.md')));
			// Symlink should point to target
			assert.strictEqual(Trail.active(), 'target');
		});

		test('should throw if output is a regular file', () => {
			fs.mkdirSync(trailsRoot, { recursive: true });
			fs.mkdirSync(path.join(trailsRoot, 'target'));
			fs.writeFileSync(outputDir, 'not a directory');

			assert.throws(() => Trail.switch('target'), /regular file/);
		});
	});

	suite('Trail.active', () => {
		test('should return undefined when no symlink exists', () => {
			assert.strictEqual(Trail.active(), undefined);
		});

		test('should return trail name from symlink', () => {
			fs.mkdirSync(path.join(trailsRoot, 'active-trail'), {
				recursive: true,
			});
			Trail.switch('active-trail');
			assert.strictEqual(Trail.active(), 'active-trail');
		});
	});

	suite('Trail.ensureSetup', () => {
		test('should create default trail and symlink when nothing exists', () => {
			Trail.ensureSetup();

			assert.ok(fs.existsSync(path.join(trailsRoot, 'default')));
			assert.strictEqual(Trail.active(), 'default');
		});

		test('should not modify existing symlink setup', () => {
			fs.mkdirSync(path.join(trailsRoot, 'my-trail'), { recursive: true });
			Trail.switch('my-trail');

			Trail.ensureSetup();

			assert.strictEqual(Trail.active(), 'my-trail');
		});

		test('should migrate existing directory to default trail', () => {
			fs.mkdirSync(outputDir, { recursive: true });
			fs.writeFileSync(path.join(outputDir, 'old-mark.md'), 'content');

			Trail.ensureSetup();

			assert.ok(fs.existsSync(path.join(trailsRoot, 'default', 'old-mark.md')));
			assert.strictEqual(Trail.active(), 'default');
		});

		test('should use first existing trail when trails exist but no symlink', () => {
			fs.mkdirSync(path.join(trailsRoot, 'beta'), { recursive: true });
			fs.mkdirSync(path.join(trailsRoot, 'alpha'), { recursive: true });

			Trail.ensureSetup();

			assert.strictEqual(Trail.active(), 'alpha');
		});
	});
});
