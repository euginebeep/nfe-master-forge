import { useRef } from 'react';
import { Copy, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyBranding } from '@/hooks/use-company-branding';
import { gerarTextoListaPura } from '@/lib/conferencia-materiais';
import { formatarQtdItem } from '@/lib/requisicoes-compra';
import { toast } from 'sonner';

export interface ItemListaPura {
  nome: string;
  quantidade: number | null | undefined;
  unidade: string | null | undefined;
}

export interface ItemListaCotacao {
  nome: string;
  qtd: string;
}

export interface GrupoListaCotacao {
  categoria: string;
  itens: ItemListaCotacao[];
}

interface ListaPuraCompraPanelProps {
  numeroInterno: string;
  itens?: ItemListaPura[];
  grupos?: GrupoListaCotacao[];
  tituloDocumento?: string;
  fornecedorNome?: string;
  hidePreview?: boolean;
  hideToolbar?: boolean;
  extraActions?: React.ReactNode;
}

function flattenGrupos(grupos: GrupoListaCotacao[]): ItemListaCotacao[] {
  return grupos.flatMap((g) => g.itens);
}

export function imprimirListaPura(element: HTMLElement | null) {
  if (!element) {
    toast.error('Documento não disponível para impressão');
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-lista-pura-print', 'true');
  style.textContent = `@media print {
    body > *:not([data-lista-pura-print-root]) { display: none !important; }
    [data-lista-pura-print-root] {
      display: block !important;
      position: fixed;
      top: 0; left: 0;
      width: 100%;
      z-index: 99999;
      background: #fff;
    }
    [data-lista-pura-print-root] * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 12mm; }
  }`;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-lista-pura-print-root', 'true');
  wrapper.innerHTML = element.innerHTML;

  document.head.appendChild(style);
  document.body.appendChild(wrapper);
  window.print();
  document.head.removeChild(style);
  document.body.removeChild(wrapper);
}

function ConteudoLista({
  tituloExibicao,
  razaoSocial,
  endereco,
  cnpj,
  logoUrl,
  linhas,
  grupos,
  fornecedorNome,
  incluirFornecedor,
}: {
  tituloExibicao: string;
  razaoSocial: string;
  endereco: string;
  cnpj?: string | null;
  logoUrl?: string | null;
  linhas: ItemListaCotacao[];
  grupos?: GrupoListaCotacao[];
  fornecedorNome?: string;
  incluirFornecedor: boolean;
}) {
  return (
    <>
      {logoUrl && <img src={logoUrl} alt="" className="h-10 mb-3 object-contain" />}
      <p className="font-bold text-base mb-1">{tituloExibicao}</p>
      <p className="mb-0.5">{razaoSocial}</p>
      {incluirFornecedor && fornecedorNome && (
        <p className="text-sm font-semibold text-gray-800 mb-1">Fornecedor: {fornecedorNome}</p>
      )}
      {cnpj && <p className="text-xs text-gray-600">CNPJ {cnpj}</p>}
      {endereco && <p className="text-gray-600 mb-3 text-xs">{endereco}</p>}
      <div className="border-t border-gray-300 my-2" />
      {grupos && grupos.length > 0 ? (
        grupos.map((grupo) => (
          <div key={grupo.categoria} className="mb-3">
            <p className="font-semibold text-xs uppercase tracking-wide text-gray-700 mb-1">
              {grupo.categoria}
            </p>
            {grupo.itens.map((item, i) => (
              <div key={`${grupo.categoria}-${i}`} className="flex justify-between py-0.5 gap-4 pl-1">
                <span className="flex-1">{item.nome}</span>
                <span className="font-semibold shrink-0 text-right max-w-[55%]">{item.qtd}</span>
              </div>
            ))}
          </div>
        ))
      ) : (
        linhas.map((item, i) => (
          <div key={i} className="flex justify-between py-0.5 gap-4">
            <span className="flex-1">{item.nome}</span>
            <span className="font-semibold shrink-0">{item.qtd}</span>
          </div>
        ))
      )}
      <div className="border-t border-gray-300 my-2" />
    </>
  );
}

export function ListaPuraCompraPanel({
  numeroInterno,
  itens = [],
  grupos,
  tituloDocumento,
  fornecedorNome,
  hidePreview = false,
  hideToolbar = false,
  extraActions,
}: ListaPuraCompraPanelProps) {
  const listaExternaRef = useRef<HTMLDivElement>(null);
  const { data: branding } = useCompanyBranding();

  const razaoSocial = branding?.razao_social || 'Empresa';
  const endereco = branding?.endereco || '';
  const numero = numeroInterno || 'REQ-PENDENTE';

  const linhas: ItemListaCotacao[] = grupos
    ? flattenGrupos(grupos)
    : itens.map((i) => ({
        nome: i.nome,
        qtd: formatarQtdItem(i.quantidade, i.unidade),
      }));

  const tituloExibicao = tituloDocumento
    ? `${tituloDocumento} — ${numero}`
    : `LISTA DE COMPRA — ${numero}`;

  const textoExterno = gerarTextoListaPura(numero, razaoSocial, endereco, linhas, {
    tituloDocumento,
    fornecedorNome,
    grupos,
  });

  const handleCopiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textoExterno);
      toast.success('Lista copiada para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar o texto');
    }
  };

  const handleBaixarImagem = async () => {
    if (!listaExternaRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(listaExternaRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `cotacao-${numero.replace(/[^a-zA-Z0-9-]/g, '')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Imagem baixada');
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao gerar imagem');
    }
  };

  const handleImprimir = () => imprimirListaPura(listaExternaRef.current);

  if (linhas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum item com quantidade para compra
      </p>
    );
  }

  const conteudoProps = {
    tituloExibicao,
    razaoSocial,
    endereco,
    cnpj: branding?.cnpj,
    logoUrl: branding?.logo_url,
    linhas,
    grupos,
    fornecedorNome,
  };

  return (
    <div className="space-y-4">
      <div
        className="bg-white p-6 rounded-lg border font-mono text-sm"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        <ConteudoLista {...conteudoProps} incluirFornecedor />
      </div>

      <div
        ref={listaExternaRef}
        aria-hidden
        className="fixed left-[-9999px] top-0 bg-white p-6 font-mono text-sm w-[640px]"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        <ConteudoLista {...conteudoProps} incluirFornecedor={false} />
      </div>

      {!hidePreview && (
        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {textoExterno}
        </pre>
      )}

      {!hideToolbar && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopiarTexto} className="flex-1 min-w-[140px]">
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          <Button variant="outline" onClick={handleBaixarImagem} className="flex-1 min-w-[140px]">
            <Download className="h-4 w-4 mr-2" />
            Baixar PNG
          </Button>
          <Button variant="outline" onClick={handleImprimir} className="flex-1 min-w-[140px]">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          {extraActions}
        </div>
      )}
    </div>
  );
}

export function buildTextoListaPuraRfq(
  numeroInterno: string,
  razaoSocial: string,
  endereco: string,
  grupos: GrupoListaCotacao[],
  fornecedorNome?: string,
): string {
  const linhas = flattenGrupos(grupos);
  return gerarTextoListaPura(numeroInterno, razaoSocial, endereco, linhas, {
    tituloDocumento: 'PEDIDO DE COTAÇÃO',
    fornecedorNome,
    grupos,
  });
}
