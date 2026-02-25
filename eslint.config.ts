import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{
		ignores: ['node_modules/', '.wrangler/', 'coverage/'],
	},
	tseslint.configs.strictTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.ts', 'vitest.config.ts'],
				},
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
		},
	},
]);
