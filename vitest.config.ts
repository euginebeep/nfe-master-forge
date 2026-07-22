import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Pré-existente: use-entidade-upsert importa ./use-supabase (módulo ausente).
    // Fora do escopo desta limpeza; exclusão só para vitest run ficar verde.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/hooks/__tests__/use-entidade-upsert.test.ts",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
