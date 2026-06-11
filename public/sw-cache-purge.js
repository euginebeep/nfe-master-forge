// Importado pelo Service Worker gerado pelo workbox.
// Garante que TODAS as caches antigas (precache + runtime) de versões
// anteriores sejam apagadas assim que o novo SW ativar.
// Força atualização em 2026-06-11T20:00:00Z — remove landing antiga
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // Nome do precache atual (criado pelo workbox-precaching)
        const currentPrecache =
          (self.workbox &&
            self.workbox.core &&
            self.workbox.core.cacheNames &&
            self.workbox.core.cacheNames.precache) ||
          null;

        const keys = await caches.keys();
        await Promise.all(
          keys.map((name) => {
            // Mantém apenas o precache da versão atual.
            if (currentPrecache && name === currentPrecache) return null;
            return caches.delete(name);
          }),
        );
      } catch (err) {
        // best-effort; não bloquear ativação
        console.warn("[sw-cache-purge] falha ao limpar caches:", err);
      }
      // Toma controle imediato de todas as abas abertas
      await self.clients.claim();
    })(),
  );
});