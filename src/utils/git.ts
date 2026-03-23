import * as vscode from 'vscode';

interface GitInfo {
	remoteUrl: string;
	commitHash: string;
}

function getGitApi(): any | undefined {
	const gitExtension = vscode.extensions.getExtension('vscode.git');
	if (!gitExtension?.isActive) {
		return undefined;
	}
	return gitExtension.exports.getAPI(1);
}

export function remoteUrlToHttps(url: string): string {
	// git@github.com:user/repo.git -> https://github.com/user/repo
	const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
	if (sshMatch) {
		return `https://${sshMatch[1]}/${sshMatch[2]}`;
	}
	// https://github.com/user/repo.git -> https://github.com/user/repo
	return url.replace(/\.git$/, '');
}

export function getGitHubUrl(
	filePath: string,
	startLine: number,
	endLine: number,
): string | undefined {
	const api = getGitApi();
	if (!api) {
		return undefined;
	}

	const repo = api.repositories[0];
	if (!repo) {
		return undefined;
	}

	const remote = repo.state.remotes.find((r: any) => r.name === 'origin');
	const remoteUrl = remote?.fetchUrl ?? remote?.pushUrl;
	if (!remoteUrl) {
		return undefined;
	}

	const commitHash = repo.state.HEAD?.commit;
	if (!commitHash) {
		return undefined;
	}

	const baseUrl = remoteUrlToHttps(remoteUrl);
	return `${baseUrl}/blob/${commitHash}/${filePath}#L${startLine}-L${endLine}`;
}
