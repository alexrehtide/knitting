import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import boundaries from 'eslint-plugin-boundaries'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

// Layer import matrix (docs/spec.md, «Архитектура»; ADR-0002).
const layerPolicies = [
  { from: { element: { type: 'application' } }, allow: { to: { element: { type: 'domain' } } } },
  {
    from: { element: { type: 'infrastructure' } },
    allow: { to: { element: { types: { anyOf: ['application', 'domain'] } } } },
  },
  {
    from: { element: { type: 'presentation' } },
    allow: { to: { element: { types: { anyOf: ['application', 'domain'] } } } },
  },
  // Only the composition root may wire adapters; other files in src/ import nothing.
  {
    from: { element: { type: 'root' }, file: { categories: 'composition-root' } },
    allow: { to: { element: { type: '*' } } },
  },
]

const coreRestrictedImports = {
  patterns: [
    {
      group: ['vue', 'vue/*', '@vue/*', 'vue-i18n'],
      message: 'Ядро не зависит от Vue (ADR-0002).',
    },
    { group: ['@nuxt/*'], message: 'Ядро не зависит от Nuxt UI (ADR-0002).' },
    {
      group: ['jspdf', 'jspdf/*'],
      message: 'PDF подключается через порт в infrastructure (ADR-0002).',
    },
  ],
}

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'node_modules/',
      '.claude/',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['src/**/*.{ts,vue}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain' },
        { type: 'application', pattern: 'src/application' },
        { type: 'infrastructure', pattern: 'src/infrastructure' },
        { type: 'presentation', pattern: 'src/presentation' },
        // Element patterns match folders: the rest of src/ is one element,
        // and only src/main.ts in it is the composition root.
        { type: 'root', pattern: 'src' },
      ],
      'boundaries/files': [{ category: 'composition-root', pattern: 'src/main.ts' }],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': ['error', { default: 'disallow', policies: layerPolicies }],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', coreRestrictedImports] },
  },

  prettier,
)
