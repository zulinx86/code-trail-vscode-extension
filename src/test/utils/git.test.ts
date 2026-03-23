import * as assert from 'assert';
import { remoteUrlToHttps } from '../../utils/git';

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
});
