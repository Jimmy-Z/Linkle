import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig({
	extends: [
		js.configs.recommended,
		tseslint.configs.strict,
		tseslint.configs.stylistic,
	],
	files: ["src/*.ts", "eslint.config.mjs"],
	rules: {
		eqeqeq: ["warn", "always", { null: "ignore" }],
		"@typescript-eslint/consistent-indexed-object-style": [
			"warn",
			"index-signature",
		],
	},
});
