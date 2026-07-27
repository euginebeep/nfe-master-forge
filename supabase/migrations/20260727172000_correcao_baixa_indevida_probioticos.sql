-- =====================================================================
-- CORRECAO DE DADOS — Reversao de baixa indevida: 9 lotes de probioticos
-- Aplicada em producao via MCP em 2026-07-27 (Barretos).
-- Versionada aqui para o repo reproduzir o estado de producao.
--
-- CAUSA: o importador da NF-e 139295 (chave 3526...4464) gravou
-- data_fab = validade e data_val = fabricacao nos 9 lotes de probiotico.
-- Fonte da verdade: <infAdProd> do XML da propria nota, conferido item a item.
--
-- CONSEQUENCIA: em 27/07/2026 os 9 lotes foram baixados por descarte como
-- "vencidos". Nenhum estava vencido — vencem entre out/2028 e jan/2029.
-- Material confirmado fisicamente em estoque por Fabio.
--
-- Tambem corrige numero_lote EK1606 -> EK1601 (XML diz EK1601).
-- NAO apaga o registro anterior: anexa anulacao a observacoes_qc.
-- =====================================================================

with correto (lote_id, lote_novo, fab_ok, val_ok) as (
  values
    ('be247173-4835-47ab-b1ca-3942f5a371af'::uuid, 'FA2302', date '2026-01-23', date '2029-01-22'),
    ('657dfc4d-e4ca-4e79-829a-8bf0383a3e81'::uuid, 'EJ27R2', date '2025-10-31', date '2028-10-30'),
    ('8acd0835-6a32-44c0-ba6e-4eb5369d28ff'::uuid, 'FA1903', date '2026-01-19', date '2029-01-18'),
    ('09f6bd6f-095d-4940-b27c-6d2b13b650e4'::uuid, 'FA1902', date '2026-01-19', date '2029-01-18'),
    ('b5a4bac8-71cb-426a-9958-cdf586b82ece'::uuid, 'EK1601', date '2025-11-16', date '2028-11-15'),
    ('98efb960-47f0-474c-85a1-f0b182e71f99'::uuid, 'EK1605', date '2025-11-16', date '2028-11-15'),
    ('4be0f4b7-edac-4ed1-b2ed-ece7f36888f1'::uuid, 'EK1802', date '2025-11-18', date '2028-11-17'),
    ('3132cad4-fdad-4695-819f-d748263741dd'::uuid, 'FA2303', date '2026-01-23', date '2029-01-22'),
    ('96f22c5c-8632-4fe4-9627-4f804c017e78'::uuid, 'FA2205', date '2026-01-22', date '2029-01-22')
)
update public.estoque_lotes el
   set data_fab = c.fab_ok, data_val = c.val_ok, numero_lote = c.lote_novo,
       quantidade_interna = 100, status = 'QUARENTENA',
       observacoes_qc = coalesce(el.observacoes_qc,'') ||
         ' | ANULADO em 28/07/2026: baixa INDEVIDA. O lote NAO estava vencido. Causa: importador da NF-e 139295 gravou data de fabricacao e validade invertidas. Datas corrigidas conforme <infAdProd> do XML da NF-e (chave 35260709005862000181550010001392951976804464): Fab ' ||
         to_char(c.fab_ok,'DD/MM/YYYY') || ', Val ' || to_char(c.val_ok,'DD/MM/YYYY') ||
         '. Material conferido fisicamente em estoque. Saldo restaurado para 100 g. Lote retorna a QUARENTENA aguardando liberacao da RT.'
  from correto c
 where el.id = c.lote_id
   and el.company_id = '60d2caee-d99d-4954-8bab-38ddf2cf5019';
