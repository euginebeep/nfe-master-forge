import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  LoteFornecedorEtiqueta,
  type LoteEtiquetaData,
} from '@/components/estoque/LoteFornecedorEtiqueta';

/**
 * Impressão de etiquetas 100x150mm (térmica), uma ou várias.
 *
 * Por que portal em vez do truque de visibility:hidden que existia antes:
 *  - visibility:hidden preserva o layout -> gerava página em branco;
 *  - o seletor antigo era um ID, então N etiquetas na mesma página
 *    quebravam (ID duplicado);
 *  - com portal, o conteúdo de impressão vive fora da árvore da página,
 *    e o CSS global só precisa esconder #root.
 *
 * Requer no index.css:
 *
 *   @media print {
 *     body.imprimindo-etiquetas > #root { display: none !important; }
 *     body.imprimindo-etiquetas > #etiquetas-print-root { display: block !important; }
 *   }
 *   #etiquetas-print-root { display: none; }
 */

/**
 * Base do QR = origem da própria aplicação.
 *
 * NÃO usar company.site: aquilo é o site institucional do tenant
 * (ex.: ProLab -> www.prolabsuplementos.com.br), que não hospeda o app.
 * O QR apontaria para um domínio que não serve a rota /audit/lote/:id.
 * window.location.origin é correto por construção e acompanha
 * automaticamente qualquer domínio próprio configurado no futuro.
 */
const BASE_QR_FALLBACK = 'https://www.brainxerp.com';

function montarQrUrl(loteId: string) {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin.replace(/\/+$/, '')
      : BASE_QR_FALLBACK;
  return `${base}/audit/lote/${loteId}`;
}

/** Busca tudo que a etiqueta precisa, para 1..N lotes, numa query só. */
export async function carregarDadosEtiquetas(loteIds: string[]): Promise<LoteEtiquetaData[]> {
  if (loteIds.length === 0) return [];

  const { data, error } = await supabase
    .from('estoque_lotes')
    .select(`
      id, numero_lote, status,
      quantidade_interna, unidade_interna,
      quantidade_original, unidade_original,
      data_fab, data_val, created_at,
      item:itens (
        descricao_interna, sku_interno, armazenamento,
        higroscopico, controle_especial, texto_alerta_padrao
      ),
      fornecedor:entidades ( razao_social, documento ),
      nota_item:notas_entrada_itens (
        nota:notas_entrada ( numero, serie )
      )
    `)
    .in('id', loteIds);

  if (error) throw error;

  const { data: empresa, error: errEmpresa } = await supabase
    .from('company')
    .select('razao_social, nome_fantasia, cnpj, licenca_sanitaria')
    .limit(1)
    .maybeSingle();

  if (errEmpresa) throw errEmpresa;
  if (!empresa) {
    throw new Error(
      'Empresa não configurada. Preencha os dados da empresa antes de imprimir etiquetas.',
    );
  }

  // preserva a ordem pedida pelo chamador
  const porId = new Map((data ?? []).map((l: any) => [l.id, l]));

  return loteIds
    .map((id) => porId.get(id))
    .filter(Boolean)
    .map((l: any) => ({
      id: l.id,
      numero_lote: l.numero_lote,
      status: l.status,
      // quantidade NORMALIZADA — unidade_original pode trazer o tamanho da
      // embalagem em vez da unidade (ex.: "25 KG"), o que fazia a etiqueta
      // imprimir "1 25 KG" num tambor de 25 kg.
      quantidade: Number(l.quantidade_interna),
      unidade: l.unidade_interna,
      embalagem_qtd: l.quantidade_original,
      embalagem_unidade: l.unidade_original,
      data_fab: l.data_fab,
      data_val: l.data_val,
      recebido_em: l.created_at,
      item: {
        descricao_interna: l.item?.descricao_interna ?? 'Insumo',
        sku_interno: l.item?.sku_interno,
        armazenamento: l.item?.armazenamento,
        higroscopico: l.item?.higroscopico,
        controle_especial: l.item?.controle_especial,
        texto_alerta_padrao: l.item?.texto_alerta_padrao,
      },
      fornecedor: l.fornecedor
        ? { razao_social: l.fornecedor.razao_social, documento: l.fornecedor.documento }
        : null,
      nota_entrada: l.nota_item?.nota
        ? { numero: l.nota_item.nota.numero, serie: l.nota_item.nota.serie }
        : null,
      empresa: {
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia,
        cnpj: empresa.cnpj ?? '',
        licenca_sanitaria: empresa.licenca_sanitaria,
      },
      qr_url: montarQrUrl(l.id),
    }));
}

export function useImprimirEtiquetas() {
  const [etiquetas, setEtiquetas] = useState<LoteEtiquetaData[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  const imprimir = useCallback(async (loteIds: string[]) => {
    if (loteIds.length === 0) {
      toast.error('Selecione ao menos um lote.');
      return;
    }
    setCarregando(true);
    try {
      const dados = await carregarDadosEtiquetas(loteIds);
      if (dados.length === 0) {
        toast.error('Nenhum lote encontrado.');
        return;
      }
      if (dados.length < loteIds.length) {
        toast.warning(`${loteIds.length - dados.length} lote(s) não puderam ser carregados.`);
      }
      setEtiquetas(dados);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao carregar dados das etiquetas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // dispara a impressão só depois que o portal renderizou de fato
  useEffect(() => {
    if (!etiquetas) return;

    document.body.classList.add('imprimindo-etiquetas');

    const limpar = () => {
      document.body.classList.remove('imprimindo-etiquetas');
      setEtiquetas(null);
    };

    window.addEventListener('afterprint', limpar, { once: true });

    // dois frames: garante que QR (SVG) já pintou antes do diálogo
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print())
    );

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('afterprint', limpar);
      document.body.classList.remove('imprimindo-etiquetas');
    };
  }, [etiquetas]);

  const portal =
    etiquetas &&
    createPortal(
      <div id="etiquetas-print-root">
        {etiquetas.map((l) => (
          <LoteFornecedorEtiqueta key={l.id} lote={l} hideActions />
        ))}
      </div>,
      document.body
    );

  return { imprimir, carregando, portal, quantidade: etiquetas?.length ?? 0 };
}
