// eslint.config.mjs
// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', 'generated', 'eslint.config.mjs'],
  },

  // Base JS
  js.configs.recommended,

  // TypeScript con chequeo de tipos
  ...tseslint.configs.recommendedTypeChecked,

  // Desactiva conflictos con Prettier
  prettier,
  eslintPluginPrettierRecommended,

  // 🔧 Bloque específico para TS con project configurado
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],          // <-- IMPORTANTE
        tsconfigRootDir: import.meta.dirname,  // <-- IMPORTANTE
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Si AuthGuard('jwt') molesta:
      // '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // (Opcional) Apagar falsos positivos en DTOs/decorators
  {
    files: ['**/*.dto.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // (Opcional) Apagar no-unsafe-call en guards (AuthGuard('jwt'))
  {
    files: ['**/*.guard.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  }
);