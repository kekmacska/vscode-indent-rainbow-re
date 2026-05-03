// eslint.config.cjs
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },

    // Register the plugin so other plugin rules can be referenced if needed
    plugins: {
      "@typescript-eslint": tsPlugin
    },

    rules: {
      // TypeScript-specific rules (keep enabled where available)
      "@typescript-eslint/naming-convention": "off",

      // Use the core `semi` rule to avoid flat-config plugin lookup issues.
      // Disable the plugin's `semi` rule to prevent "Could not find 'semi' in plugin" errors.
      "@typescript-eslint/semi": "off",
      "semi": ["warn", "always"],

      // Other rules
      "curly": "off",
      "eqeqeq": "warn",
      "no-throw-literal": "warn"
    }
  }
];
