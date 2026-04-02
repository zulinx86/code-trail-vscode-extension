import * as vscode from 'vscode';
import { log } from './logger';

export function remoteUrlToHttps(url: string): string {
	// git@github.com:user/repo.git -> https://github.com/user/repo
	const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
	if (sshMatch) {
		return `https://${sshMatch[1]}/${sshMatch[2]}`;
	}
	// https://github.com/user/repo.git -> https://github.com/user/repo
	return url.replace(/\.git$/, '');
}

function getGitApi(): any | undefined {
	const gitExtension = vscode.extensions.getExtension('vscode.git');
	if (!gitExtension?.isActive) {
		return undefined;
	}
	return gitExtension.exports.getAPI(1);
}

export function getGitHubUrl(
	filePath: string,
	startLine: number,
	endLine: number,
): string | undefined {
	const api = getGitApi();
	if (!api) {
		log('getGitHubUrl: git API not available');
		return undefined;
	}

	const repo = api.repositories[0];
	if (!repo) {
		log('getGitHubUrl: no repository found');
		return undefined;
	}

	const origin = repo.state.remotes.find((r: any) => r.name === 'origin');
	const originUrl = origin?.fetchUrl ?? origin?.pushUrl;
	if (!originUrl) {
		log('getGitHubUrl: no remote "origin" URL found');
		return undefined;
	}

	const commitHash = repo.state.HEAD?.commit;
	if (!commitHash) {
		log('getGitHubUrl: no commit hash found');
		return undefined;
	}

	const baseUrl = remoteUrlToHttps(originUrl);
	const url = `${baseUrl}/blob/${commitHash}/${filePath}#L${startLine}-L${endLine}`;
	log(`getGitHubUrl: ${url}`);
	return url;
}
