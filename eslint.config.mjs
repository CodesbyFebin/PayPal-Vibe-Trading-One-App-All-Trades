// Minimal ESLint flat config. Install ESLint 9+ before running: npx eslint .
export default [
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**", "build/**", ".vercel/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
    },
  },
];
