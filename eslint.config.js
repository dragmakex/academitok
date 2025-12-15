import effectPlugin from "@effect/eslint-plugin"
import { fixupPluginRules } from "@eslint/compat"
import { FlatCompat } from "@eslint/eslintrc"
import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import _import from "eslint-plugin-import"
import jsdoc from "eslint-plugin-jsdoc"
import sortDestructureKeys from "eslint-plugin-sort-destructure-keys"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Import local rules files
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const localRules = require("./eslint-local-rules.cjs")
const advancedLocalRules = require("./eslint-local-rules-advanced.cjs")

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default [
  {
    ignores: [
      "**/dist",
      "**/build",
      "**/docs",
      "**/*.md",
      "**/*.cjs",
      "**/*.js",
      "node_modules",
      ".output",
      ".worktrees/",
    ],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ),
  {
    plugins: {
      import: fixupPluginRules(_import),
      "sort-destructure-keys": sortDestructureKeys,
      "@effect": effectPlugin,
      "jsdoc": jsdoc,
      // Add local rules
      "local": { rules: localRules },
      "local-advanced": { rules: advancedLocalRules },
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: "module",
      parserOptions: {
        checkJSDoc: true,
      },
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },

      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      "jsdoc": {
        "mode": "typescript",
      },
    },

    rules: {
      "camelcase": "error",
      "max-lines": ["error", { "max": 500, "skipComments": true }],
      "complexity": ["error", { "max": 20, "variant": "modified" }],
      "require-atomic-updates": "error",
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", {
        "max": 150,
        "skipBlankLines": true,
        "skipComments": true,
      }],
      "eqeqeq": "error",
      "prefer-template": "error",
      "sort-vars": "error",
      "curly": "error",
      "default-case-last": "error",
      "dot-notation": "error",
      "jsdoc/check-alignment": "error",
      "jsdoc/check-indentation": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-syntax": "error",
      "jsdoc/check-tag-names": ["error", { definedTags: ["remarks"] }],
      "jsdoc/require-description": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          "require": {
            "FunctionDeclaration": true,
            "MethodDefinition": true,
          },
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-param-name": "error",
      // TypeScript provides types - JSDoc types are redundant
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-check": "error",
      "jsdoc/require-returns-description": "error",
      // TypeScript provides types - JSDoc types are redundant
      "jsdoc/require-returns-type": "off",

      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "no-useless-concat": "error",
      "object-shorthand": "error",
      "prefer-destructuring": "off",
      "sort-imports": "off",

      "no-restricted-syntax": ["error", {
        selector:
          "CallExpression[callee.property.name='push'] > SpreadElement.arguments",
        message: "Do not use spread arguments in Array.push",
      }],
      "no-unused-vars": "off",
      "prefer-rest-params": "off",
      "prefer-spread": "off",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": "off",
      "import/order": "off",
      "sort-destructure-keys/sort-destructure-keys": "error",
      "deprecation/deprecation": "off",

      "@typescript-eslint/array-type": ["warn", {
        default: "generic",
        readonly: "generic",
      }],

      "@typescript-eslint/member-delimiter-style": 0,
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-restricted-types": ["error", {
        types: {
          "Object": {
            message: "Use object or a specific type instead",
            fixWith: "object",
          },
          "{}": { message: "Use object or Record<string, unknown> instead" },
          "Function": {
            message: "Use a specific function type like () => void instead",
          },
        },
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/consistent-type-imports": "warn",

      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],

      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "ts-nocheck": true,
      }],
      "@typescript-eslint/camelcase": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/no-array-constructor": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-namespace": "off",

      // "@effect/dprint": ["error", {
      //   config: {
      //     indentWidth: 2,
      //     lineWidth: 80,
      //     semiColons: "asi",
      //     quoteStyle: "alwaysDouble",
      //     trailingCommas: "onlyMultiLine",
      //     operatorPosition: "maintain",
      //     "arrowFunction.useParentheses": "force",
      //   },
      // }],

      // @effect eslint plugin rules
      "@effect/no-import-from-barrel-package": "error",

      // Custom local rules from eslint-local-rules.cjs
      "local/no-opaque-instance-fields": "error",

      // Advanced custom rules from eslint-local-rules-advanced.cjs
      "local-advanced/no-try-catch-in-effect-gen": "error",
      "local-advanced/no-type-assertions": "error",
      "local-advanced/require-return-yield-for-errors": "error",
      "local-advanced/no-effect-runsync-in-gen": "error",
      "local-advanced/prefer-effect-constructors": "warn",
    },
  },
]
