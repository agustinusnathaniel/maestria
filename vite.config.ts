import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
    tasks: {
      "website#dev": {
        command: "astro dev --root apps/docs",
        cache: false,
      },
      "website#build": {
        command: "astro build --root apps/docs",
      },
      "website#preview": {
        command: "astro preview --root apps/docs",
        cache: false,
      },
    },
  },
});
