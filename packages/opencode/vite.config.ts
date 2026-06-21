import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    target: "node22",
    sourcemap: true,
    minify: true,
    fixedExtension: false,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
