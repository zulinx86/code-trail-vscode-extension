import * as assert from 'assert';
import { remoteUrlToHttps, getGitHubUrl } from '../../utils/git';

suite('git', () => {
	suite('remoteUrlToHttps', () => {
		test('should convert SSH URL to HTTPS', () => {
			assert.strictEqual(
				remoteUrlToHttps('git@github.com:user/repo.git'),
				'https://github.com/user/repo',
			);
		});

		test('should convert SSH URL without .git suffix', () => {
			assert.strictEqual(
				remoteUrlToHttps('git@github.com:user/repo'),
				'https://github.com/user/repo',
			);
		});

		test('should strip .git suffix from HTTPS URL', () => {
			assert.strictEqual(
				remoteUrlToHttps('https://github.com/user/repo.git'),
				'https://github.com/user/repo',
			);
		});

		test('should return HTTPS URL as-is when no .git suffix', () => {
			assert.strictEqual(
				remoteUrlToHttps('https://github.com/user/repo'),
				'https://github.com/user/repo',
			);
		});
	});

	suite('getGitHubUrl', () => {
		test('should return a valid GitHub URL for a file in the repo', () => {
			const url = getGitHubUrl('src/extension.ts', 1, 10);
			if (!url) {
				// Git extension not available in test environment
				return;
			}
			assert.ok(url.startsWith('https://github.com/'));
			assert.ok(url.includes('/blob/'));
			assert.ok(url.endsWith('src/extension.ts#L1-L10'));
		});
	});
});
