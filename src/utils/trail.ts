import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OUTPUT_DIR, TRAILS_DIR, workspaceFolder } from '../config';
import { log } from './logger';

export class Trail {
	private static get outputDir(): string {
		return path.join(workspaceFolder!.uri.fsPath, OUTPUT_DIR);
	}

	private static get trailsRoot(): string {
		return path.join(workspaceFolder!.uri.fsPath, TRAILS_DIR);
	}

	private static trailPath(name: string): string {
		return path.join(Trail.trailsRoot, name);
	}

	/** Lists all existing trail names. */
	static list(): string[] {
		const root = Trail.trailsRoot;
		if (!fs.existsSync(root)) {
			return [];
		}
		return fs
			.readdirSync(root, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort();
	}

	/**
	 * Returns the name of the currently active trail,
	 * or undefined if no symlink exists.
	 */
	static active(): string | undefined {
		try {
			const resolved = fs.readlinkSync(Trail.outputDir);
			const parts = resolved.split(path.sep);
			return parts[parts.length - 1];
		} catch {
			return undefined;
		}
	}

	/** Creates a new trail directory and switches to it. */
	static create(name: string): void {
		const newTrail = Trail.trailPath(name);
		if (fs.existsSync(newTrail)) {
			throw new Error(`Trail "${name}" already exists`);
		}
		fs.mkdirSync(newTrail, { recursive: true });
		log(`Trail.create: created ${newTrail}`);
		Trail.switch(name);
	}

	/** Switches the output directory to point to the given trail. */
	static switch(name: string): void {
		if (!fs.existsSync(Trail.trailPath(name))) {
			throw new Error(`Trail "${name}" does not exist`);
		}

		const output = Trail.outputDir;
		const relativeTrail = path.join(TRAILS_DIR, name);

		if (fs.existsSync(output)) {
			const stat = fs.lstatSync(output);
			if (stat.isSymbolicLink()) {
				fs.unlinkSync(output);
			} else if (stat.isDirectory()) {
				Trail.migrateExistingDir(output);
			} else {
				throw new Error(
					`"${OUTPUT_DIR}" exists but is a regular file. Please remove it manually.`,
				);
			}
		}

		fs.symlinkSync(relativeTrail, output);
		log(`Trail.switch: ${output} -> ${relativeTrail}`);
	}

	/**
	 * Ensures the trail infrastructure exists. Migrates an existing
	 * code-trail/ directory to the "default" trail if needed.
	 */
	static ensureSetup(): void {
		const output = Trail.outputDir;
		const root = Trail.trailsRoot;

		if (!fs.existsSync(root)) {
			fs.mkdirSync(root, { recursive: true });
		}

		if (fs.existsSync(output)) {
			const stat = fs.lstatSync(output);
			if (stat.isSymbolicLink()) return;
			if (stat.isDirectory()) {
				Trail.migrateExistingDir(output);
				Trail.switch('default');
			} else {
				vscode.window.showErrorMessage(
					`"${OUTPUT_DIR}" exists but is a regular file. Please remove it manually.`,
				);
			}
			return;
		}

		const trails = Trail.list();
		if (trails.length === 0) {
			fs.mkdirSync(Trail.trailPath('default'), { recursive: true });
			log('Trail.ensureSetup: created default trail');
		}
		Trail.switch(trails.length > 0 ? trails[0] : 'default');
	}

	/** Migrates an existing code-trail/ directory into a "default" trail. */
	private static migrateExistingDir(existingDir: string): void {
		const defaultTrail = Trail.trailPath('default');
		fs.mkdirSync(defaultTrail, { recursive: true });

		const entries = fs.readdirSync(existingDir);
		for (const entry of entries) {
			fs.renameSync(
				path.join(existingDir, entry),
				path.join(defaultTrail, entry),
			);
		}
		log(
			`Trail.migrateExistingDir: moved ${entries.length} files to default trail`,
		);
		fs.rmdirSync(existingDir);
	}
}
