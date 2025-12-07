import js from "@eslint/js"
import tseslint from "typescript-eslint"
import prettier from "eslint-plugin-prettier"
import prettierConfig from "eslint-config-prettier"

export default [
  {
    ignores: ["dist/**", "node_modules/**", ".aws-sam/**", "**/*.js", "ref/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettier,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),
]
