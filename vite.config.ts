import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icon-192.png", "icon-512.png", "brainx-logo.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Não usar fallback de navegação para que toda navegação
        // bata no servidor (ver runtimeCaching abaixo)
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
        // Limpa proativamente TODAS as caches que não pertencem
        // ao precache da versão atual a cada novo deploy.
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
