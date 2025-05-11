import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      beru: path.resolve(__dirname, "../src"),
      persistence: path.resolve(__dirname, "../src/middleware/persistence"),
      devtools: path.resolve(__dirname, "../src/middleware/devtools"),
    },
  },
});
