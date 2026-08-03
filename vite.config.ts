import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const { version: appVersion } = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Lê package.json direto — npm_package_version some se o Vite for
    // invocado fora de um script npm (ex.: vite binário / CI parcial).
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt" em vez de "autoUpdate" — o SW novo fica em espera e
      // NUNCA recarrega a página automaticamente. O main.tsx exibe um
      // toast discreto para o usuário decidir quando atualizar.
      registerType: "prompt",
      includeAssets: ["favicon.png", "icon-192.png", "icon-512.png", "brainx-logo.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        cleanupOutdatedCaches: true,
        // CRÍTICO: skipWaiting: false — impede que o SW novo tome controle
        // imediatamente e force um reload enquanto o usuário está trabalhando.
        skipWaiting: false,
        // CRÍTICO: clientsClaim: false — o SW novo só assume após o usuário
        // fechar todas as abas e reabrir, ou clicar em "Recarregar agora".
        clientsClaim: false,
        navigateFallback: null,
        runtimeCaching: [
          {
            // HTML / navegação: NUNCA servir do cache.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly",
          },
          {
            // index.html explícito — também sempre da rede
            urlPattern: ({ url }) =>
              url.pathname === "/" || url.pathname.endsWith("/index.html"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/.*supabase.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
        importScripts: ["/sw-cache-purge.js"],
      },
      manifest: {
        name: "BrainX ERP - Gestão Industrial",
        short_name: "BrainX ERP",
        description: "Sistema de gestão empresarial e industrial para indústrias de suplementos e nutracêuticos",
        start_url: "/",
        display: "standalone",
        background_color: "#0F2A44",
        theme_color: "#0F2A44",
        orientation: "any",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/favicon.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
