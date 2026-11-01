import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const TRANSPORT_RULE = 'Only lib/api/client/* may import the transport.';
const FEATURES_RULE =
  'Shared components (common, ui) must not import features — put shared display data in @/lib/labels/* instead.';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Boundary (app/AGENTS.md): UI / features never import the transport — only
    // lib/api/client/* does.
    files: ['src/**/*.{js,mjs,ts,tsx}'],
    ignores: ['src/lib/api/client/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/api/transport', '**/lib/api/transport/**'],
              message: TRANSPORT_RULE,
            },
          ],
        },
      ],
    },
  },
  {
    // Boundary (app/AGENTS.md): common/ui never import features. components/layout is
    // the sanctioned exception, so it is deliberately out of scope here.
    files: ['src/components/common/**/*.{js,mjs,ts,tsx}', 'src/components/ui/**/*.{js,mjs,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/features', '@/features/*', '@/features/**'], message: FEATURES_RULE },
            {
              group: ['**/lib/api/transport', '**/lib/api/transport/**'],
              message: TRANSPORT_RULE,
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
