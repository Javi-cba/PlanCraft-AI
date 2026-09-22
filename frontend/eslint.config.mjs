import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * eslint-config-next 15.5 still ships eslintrc-style configs (its `extends`
 * holds plugin strings, not flat config objects), so they are translated with
 * `FlatCompat`. Spreading the package export directly throws "not iterable",
 * and handing it to `defineConfig` as-is throws `Plugin "" not found`.
 */
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
