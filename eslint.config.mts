import { defineConfig, globalIgnores } from 'eslint/config';
import eslintJavascriptPlugin from '@eslint/js';
import { configs as typescriptEslintConfigs } from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxAccessibilityPlugin from 'eslint-plugin-jsx-a11y-x';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import prettierCompatibilityConfig from 'eslint-config-prettier';
import { browser as browserGlobals, node as nodeGlobals } from 'globals';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    'coverage/',
    'claude_tmp/',
    'playwright-report/',
    'test-results/',
  ]),

  eslintJavascriptPlugin.configs.recommended,
  typescriptEslintConfigs.strictTypeChecked,
  typescriptEslintConfigs.stylisticTypeChecked,
  {
    name: 'khalah/type-aware-parsing',
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // CLAUDE.md: every function documents its intent and parameters in JSDoc.
  jsdocPlugin.configs['flat/recommended-typescript-error'],
  {
    name: 'khalah/jsdoc-on-every-named-function',
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'VariableDeclarator > ArrowFunctionExpression',
            'VariableDeclarator > FunctionExpression',
            'Property > ArrowFunctionExpression',
            'Property > FunctionExpression',
            'PropertyDefinition > ArrowFunctionExpression',
          ],
        },
      ],
      'jsdoc/require-description': 'error',
    },
  },

  {
    ...reactHooksPlugin.configs.flat.recommended,
    name: 'khalah/react-hooks',
    files: ['**/*.tsx'],
  },
  {
    ...jsxAccessibilityPlugin.configs.recommended,
    name: 'khalah/jsx-accessibility',
    files: ['**/*.tsx'],
  },

  {
    name: 'khalah/browser-globals',
    files: ['apps/web/src/**'],
    languageOptions: { globals: browserGlobals },
  },
  {
    name: 'khalah/node-globals',
    files: [
      '*.mts',
      'apps/server/**',
      'apps/web/vite.config.mts',
      'packages/**',
      'scripts/**',
      'e2e/**',
    ],
    languageOptions: { globals: nodeGlobals },
  },

  // Must stay last: turns off every stylistic rule that Prettier owns.
  prettierCompatibilityConfig,
);
