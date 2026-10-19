import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('vite').UserConfig} */
export default {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  // Production: Express serves this from backend/public (no nginx).
  build: {
    outDir: path.resolve(__dirname, "../backend/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://192.168.169.12:7047",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (!cookies) return;
            proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
              cookie
                .replace(/;\s*Secure/gi, "")
                .replace(/;\s*Domain=[^;]+/gi, ""),
            );
          });
        },
      },
      "/uploads": {
        target: process.env.VITE_PROXY_TARGET || "http://192.168.169.12:7047",
        changeOrigin: true,
      },
    },
  },
};
