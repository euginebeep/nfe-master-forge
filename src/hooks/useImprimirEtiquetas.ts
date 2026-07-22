/**
 * Impressão térmica de etiquetas 100×150mm.
 * Isola o print em #etiquetas-print-root (ver src/index.css).
 */

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  LoteFornecedorEtiqueta,
  type DadosEtiquetaLote,
} from "@/components/estoque/LoteFornecedorEtiqueta";

function baseUrlEmpresa(site: string | null | undefined): string {
  const raw = (site || "").trim();
  if (!raw) return "https://www.brainxerp.com";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

/** Carrega os mesmos dados usados na tela de detalhe e na impressão em lote. */
export async function carregarDadosEtiquetas(
  loteIds: string[],
): Promise<DadosEtiquetaLote[]> {
  const ids = [...new Set(loteIds.filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("estoque_lotes")
    .select(`
      id,
      numero_lote,
      quantidade_original,
      unidade_original,
      data_fab,
      data_val,
      status,
      created_at,
      company_id,
      item:itens (
        descricao_interna,
        sku_interno,
        armazenamento,
        texto_alerta_padrao
      ),
      fornecedor:entidades (
        razao_social
      ),
      nota_item:notas_entrada_itens (
        nota_entrada:notas_entrada (
          numero,
          serie,
          dh_emissao
        )
      )
    `)
    .in("id", ids);

  if (error) throw error;

  const byId = new Map((data ?? []).map((r: any) => [r.id as string, r]));

  // company via lote.company_id quando a NF não trouxer
  const companyIds = [
    ...new Set(
      (data ?? [])
        .map((r: any) => r.company_id as string | null)
        .filter(Boolean),
    ),
  ] as string[];

  const companyMap = new Map<string, any>();
  if (companyIds.length) {
    const { data: companies } = await supabase
      .from("company")
      .select("id, razao_social, nome_fantasia, site, cnpj")
      .in("id", companyIds);
    for (const c of companies ?? []) companyMap.set(c.id, c);
  }

  const ordered: DadosEtiquetaLote[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;

    const nota = r.nota_item?.nota_entrada ?? null;
    const empresa = r.company_id ? companyMap.get(r.company_id) ?? null : null;

    const siteBase = baseUrlEmpresa(empresa?.site);

    ordered.push({
      id: r.id,
      numero_lote: r.numero_lote,
      quantidade_original: Number(r.quantidade_original ?? 0),
      unidade_original: r.unidade_original || "un",
      data_fab: r.data_fab,
      data_val: r.data_val,
      status: r.status || "QUARENTENA",
      recebido_em: r.created_at,
      qr_url: `${siteBase}/audit/lote/${r.id}`,
      item: {
        descricao_interna: r.item?.descricao_interna || "Insumo",
        sku_interno: r.item?.sku_interno ?? null,
        armazenamento: r.item?.armazenamento ?? null,
        texto_alerta_padrao: r.item?.texto_alerta_padrao ?? null,
      },
      fornecedor: r.fornecedor
        ? { razao_social: r.fornecedor.razao_social }
        : null,
      empresa: empresa
        ? {
            razao_social: empresa.razao_social,
            nome_fantasia: empresa.nome_fantasia ?? null,
            site: empresa.site ?? null,
            cnpj: empresa.cnpj ?? null,
          }
        : null,
      nota_entrada: nota
        ? {
            numero: nota.numero,
            serie: nota.serie ?? null,
            dh_emissao: nota.dh_emissao ?? null,
          }
        : null,
    });
  }

  return ordered;
}

export function useImprimirEtiquetas() {
  const [lotes, setLotes] = useState<DadosEtiquetaLote[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const garantirPortalRoot = useCallback(() => {
    let el = document.getElementById("etiquetas-print-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "etiquetas-print-root";
      document.body.appendChild(el);
    }
    setPortalReady(true);
    return el;
  }, []);

  const imprimir = useCallback(
    async (loteIds: string[]) => {
      if (!loteIds.length) {
        toast.info("Nenhum lote selecionado para impressão.");
        return;
      }
      setCarregando(true);
      try {
        const dados = await carregarDadosEtiquetas(loteIds);
        if (!dados.length) {
          toast.info("Nenhum lote encontrado para imprimir.");
          return;
        }
        garantirPortalRoot();
        setLotes(dados);

        // Aguarda o portal pintar as páginas antes do diálogo nativo
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 50));

        document.body.classList.add("imprimindo-etiquetas");
        const limpar = () => {
          document.body.classList.remove("imprimindo-etiquetas");
          window.removeEventListener("afterprint", limpar);
        };
        window.addEventListener("afterprint", limpar);
        window.print();
        // fallback se afterprint não disparar
        setTimeout(limpar, 1500);
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error(err.message ?? "Falha ao preparar etiquetas.");
      } finally {
        setCarregando(false);
      }
    },
    [garantirPortalRoot],
  );

  const portal = useMemo(() => {
    if (typeof document === "undefined") return null;
    const root = document.getElementById("etiquetas-print-root");
    if (!root || !portalReady || !lotes.length) return null;
    return createPortal(
      <div className="etiquetas-print-stack">
        {lotes.map((lote) => (
          <div key={lote.id} className="etiqueta-print-page">
            <LoteFornecedorEtiqueta lote={lote} modoImpressao />
          </div>
        ))}
      </div>,
      root,
    );
  }, [lotes, portalReady]);

  return { imprimir, carregando, portal };
}
