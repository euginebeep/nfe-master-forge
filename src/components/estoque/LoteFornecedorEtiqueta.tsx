import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Download, Package, Calendar, User, Truck, ShieldCheck, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LoteFornecedorEtiquetaProps {
  lote: {
    numero_lote: string;
    quantidade_original: number;
    unidade_original: string;
    data_fab?: string | null;
    data_val?: string | null;
    item: {
      descricao_interna: string;
      sku_interno?: string;
    };
    fornecedor?: {
      razao_social: string;
    } | null;
    qr_url: string;
  };
}

export function LoteFornecedorEtiqueta({ lote }: LoteFornecedorEtiquetaProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-2" /> Imprimir Etiqueta
        </Button>
      </div>

      <div 
        id="etiqueta-lote-fornecedor"
        className="w-[100mm] h-[150mm] border-2 border-black bg-white p-4 mx-auto flex flex-col text-black font-sans print:border-0 print:m-0"
      >
        {/* Header */}
        <div className="border-b-2 border-black pb-2 mb-3 text-center">
          <h1 className="text-xl font-black uppercase tracking-tight">Identificação de Insumo</h1>
          <p className="text-[10px] font-bold text-gray-600">BrainX ERP — Controle de Qualidade</p>
        </div>

        {/* Lote e Item */}
        <div className="space-y-3 flex-1">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500">Insumo / Matéria-Prima</label>
            <p className="text-lg font-bold leading-tight line-clamp-2">{lote.item.descricao_interna}</p>
            {lote.item.sku_interno && (
              <p className="text-xs font-mono">SKU: {lote.item.sku_interno}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-y-2 border-black py-2">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500">Lote Fornecedor</label>
              <p className="text-xl font-black font-mono">{lote.numero_lote}</p>
            </div>
            <div className="text-right">
              <label className="text-[10px] font-black uppercase text-gray-500">Quantidade</label>
              <p className="text-xl font-black">{Number(lote.quantidade_original).toLocaleString('pt-BR')} {lote.unidade_original}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" /> Fabricação
              </label>
              <p className="text-sm font-bold">{lote.data_fab ? format(new Date(lote.data_fab), 'dd/MM/yyyy') : '—'}</p>
            </div>
            <div className="text-right">
              <label className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1 justify-end">
                <Calendar className="h-2.5 w-2.5" /> Validade
              </label>
              <p className="text-sm font-bold text-red-600">{lote.data_val ? format(new Date(lote.data_val), 'dd/MM/yyyy') : '—'}</p>
            </div>
          </div>

          <div className="border-t border-black pt-2">
            <label className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1">
              <Truck className="h-2.5 w-2.5" /> Fornecedor
            </label>
            <p className="text-xs font-bold truncate">{lote.fornecedor?.razao_social || 'Não informado'}</p>
          </div>
        </div>

        {/* QR Code and Footer */}
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div className="flex flex-col items-center gap-1">
            <QRCodeSVG
              value={lote.qr_url}
              size={120}
              level="H"
              includeMargin
              className="border border-black p-1"
            />
            <span className="text-[8px] font-mono uppercase text-center max-w-[120px] break-all">
              ID: {lote.numero_lote}
            </span>
          </div>

          <div className="flex-1 pl-4 space-y-2 text-right">
            <div className="bg-black text-white p-1 text-[10px] font-black text-center uppercase">
              Aguardando Inspeção
            </div>
            <div className="flex flex-col gap-1 items-end">
              <div className="flex items-center gap-1 text-[8px] font-bold">
                <ShieldCheck className="h-3 w-3" /> Rastreabilidade Digital
              </div>
              <div className="flex items-center gap-1 text-[8px] font-bold">
                <MapPin className="h-3 w-3" /> Recebido em: {format(new Date(), 'dd/MM/yy HH:mm')}
              </div>
            </div>
          </div>
        </div>

        {/* Print specific styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            #etiqueta-lote-fornecedor, #etiqueta-lote-fornecedor * { visibility: visible; }
            #etiqueta-lote-fornecedor {
              position: absolute;
              left: 0;
              top: 0;
              width: 100mm;
              height: 150mm;
            }
          }
        `}} />
      </div>
    </div>
  );
}
