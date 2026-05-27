import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig } from "eslint/config";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ["warn", "multi"],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "unicorn/no-null": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "unicorn/no-process-exit": "warn",
      "unicorn/filename-case": "off",
      "unicorn/no-await-expression-member": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "unicorn/prefer-module": "error",
      "unicorn/prevent-abbreviations": [
        "error",
        {
          replacements: {
            db: false,
            mod: false,
            def: false,
            res: false,
          },
        },
      ],
      "unicorn/import-style": [
        "error",
        {
          styles: {
            "node:path": {
              named: true,
            },
          },
        },
      ],
    },
  },
);
