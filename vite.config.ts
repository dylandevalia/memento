import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@mui/icons-material")) return "vendor-mui-icons";
          if (id.includes("@mui") || id.includes("@emotion"))
            return "vendor-mui";
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("node_modules/react/")
          )
            return "vendor-react";
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
