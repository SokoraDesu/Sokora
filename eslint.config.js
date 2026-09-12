import eslint from "@eslint/js";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import { bracketlessNewline } from "./ql/bracketless-newline.ts";

export default defineConfig(
  globalIgnores(["eslint.config.js"]),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  {
    plugins: {
      local: {
        rules: {
          "no-bracketless-if-without-blank-line": bracketlessNewline,
        },
      },
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ["warn", "multi"],
      "local/no-bracketless-if-without-blank-line": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "unicorn/string-content": [
        "error",
        {
          patterns: {
            "\\.\\.\\.": "…",
            "'": "’",
            "·": "•",
          },
        },
      ],
      "@typescript-eslint/consistent-generic-constructors": "error",
      "@typescript-eslint/no-dynamic-delete": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
        },
      ],
      "unicorn/no-null": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "unicorn/no-process-exit": "warn",
      "unicorn/filename-case": "off",
      "unicorn/no-await-expression-member": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "unicorn/prefer-module": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-implied-eval": "error",
      "no-proto": "error",
      "no-extend-native": "error",
      "no-script-url": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: { arguments: false },
        },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",
      "no-constant-binary-expression": "error",
      "no-constructor-return": "error",
      "no-promise-executor-return": "error",
      "no-self-compare": "error",
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": "error",
      "@typescript-eslint/no-loop-func": "error",
      "@typescript-eslint/no-this-alias": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/max-nested-calls": "off",
      "unicorn/no-unsafe-string-replacement": "off",
      "unicorn/no-top-level-side-effects": "off",
      "unicorn/prefer-await": "off", // i actually want to enable this, but requires refactors i'm lazy for
      "unicorn/name-replacements": [
        "error",
        {
          replacements: {
            mod: false,
            db: false,
            mod: false,
            def: false,
            res: false,
          },
        },
      ],
      "unicorn/import-style": "error",
    },
  },
);
