import { useRef } from 'react';
import { Copy, Download } from 'lucide-react';
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

interface ListaPuraCompraPanelProps {
  numeroInterno: string;
  itens: ItemListaPura[];
  tituloDocumento?: string;
  fornecedorNome?: string;
}

export function ListaPuraCompraPanel({
  numeroInterno,
  itens,
  tituloDocumento,
  fornecedorNome,
}: ListaPuraCompraPanelProps) {
  const listaPuraRef = useRef<HTMLDivElement>(null);
  const { data: branding } = useCompanyBranding();

  const razaoSocial = branding?.razao_social || 'Empresa';
  const endereco = branding?.endereco || '';
  const numero = numeroInterno || 'REQ-PENDENTE';

  const itensFormatados = itens.map(i => ({
    nome: i.nome,
    qtd: formatarQtdItem(i.quantidade, i.unidade),
  }));

  const textoListaPura = gerarTextoListaPura(numero, razaoSocial, endereco, itensFormatados, {
    tituloDocumento,
    fornecedorNome,
  });

  const tituloExibicao = tituloDocumento
    ? `${tituloDocumento} — ${numero}`
    : `LISTA DE COMPRA — ${numero}`;

  const handleCopiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textoListaPura);
      toast.success('Lista copiada para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar o texto');
    }
  };

  const handleBaixarImagem = async () => {
    if (!listaPuraRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(listaPuraRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `lista-compra-${numero.replace(/[^a-zA-Z0-9-]/g, '')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Imagem baixada');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Erro ao gerar imagem');
    }
  };

  if (itens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum item com quantidade para compra
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={listaPuraRef}
        className="bg-white p-6 rounded-lg border font-mono text-sm"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        {branding?.logo_url && (
          <img src={branding.logo_url} alt="" className="h-10 mb-3 object-contain" />
        )}
        <p className="font-bold text-base mb-1">{tituloExibicao}</p>
        <p className="mb-0.5">{razaoSocial}</p>
        {fornecedorNome && (
          <p className="text-sm font-semibold text-gray-800 mb-1">Fornecedor: {fornecedorNome}</p>
        )}
        {branding?.cnpj && <p className="text-xs text-gray-600">CNPJ {branding.cnpj}</p>}
        {endereco && <p className="text-gray-600 mb-3 text-xs">{endereco}</p>}
        <div className="border-t border-gray-300 my-2" />
        {itensFormatados.map((item, i) => (
          <div key={i} className="flex justify-between py-0.5 gap-4">
            <span className="flex-1">{item.nome}</span>
            <span className="font-semibold shrink-0">{item.qtd}</span>
          </div>
        ))}
        <div className="border-t border-gray-300 my-2" />
      </div>

      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
        {textoListaPura}
      </pre>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={handleCopiarTexto} className="flex-1">
          <Copy className="h-4 w-4 mr-2" />
          Copiar texto
        </Button>
        <Button onClick={handleBaixarImagem} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Baixar imagem
        </Button>
      </div>
    </div>
  );
}
