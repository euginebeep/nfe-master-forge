import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, Calendar, Truck, Building2, Thermometer } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

export type DadosEtiquetaLote = {
  id: string;
  numero_lote: string;
  quantidade_original: number;
  unidade_original: string;
  data_fab?: string | null;
  data_val?: string | null;
  status: string;
  /** Data real de entrada no estoque (não "agora") */
  recebido_em?: string | null;
  qr_url: string;
  item: {
    descricao_interna: string;
    sku_interno?: string | null;
    armazenamento?: string | null;
    texto_alerta_padrao?: string | null;
  };
  fornecedor?: { razao_social: string } | null;
  empresa?: {
    razao_social: string;
    nome_fantasia?: string | null;
    site?: string | null;
    cnpj?: string | null;
  } | null;
  nota_entrada?: {
    numero: string | null;
    serie?: string | null;
    dh_emissao?: string | null;
  } | null;
};

interface LoteFornecedorEtiquetaProps {
  lote: DadosEtiquetaLote;
  /** Sem botão / chrome — só o layout da folha térmica */
  modoImpressao?: boolean;
  onImprimir?: () => void;
}

function fmtData(value?: string | null, withTime = false): string {
  if (!value) return "—";
  const d = value.length <= 10 ? parseISO(value) : new Date(value);
  if (!isValid(d)) return "—";
  return withTime
    ? format(d, "dd/MM/yy HH:mm")
    : format(d, "dd/MM/yyyy");
}

function faixaStatus(status: string): {
  texto: string;
  classe: string;
} {
  const s = (status || "").toUpperCase();
  if (s === "QUARENTENA") {
    return {
      texto: "QUARENTENA — NÃO UTILIZAR",
      classe:
        "bg-[repeating-linear-gradient(45deg,#111_0,#111_6px,#fbbf24_6px,#fbbf24_12px)] text-white",
    };
  }
  if (s === "BLOQUEADO" || s === "REJEITADO") {
    return {
      texto: "BLOQUEADO — NÃO UTILIZAR",
      classe: "bg-black text-white",
    };
  }
  if (s === "DISPONIVEL" || s === "APROVADO" || s === "LIBERADO") {
    return {
      texto: "LIBERADO PARA PRODUÇÃO",
      classe: "bg-black text-white",
    };
  }
  return {
    texto: s || "STATUS INDEFINIDO",
    classe: "bg-neutral-800 text-white",
  };
}

export function LoteFornecedorEtiqueta({
  lote,
  modoImpressao = false,
  onImprimir,
}: LoteFornecedorEtiquetaProps) {
  const faixa = faixaStatus(lote.status);
  const empresaNome =
    lote.empresa?.nome_fantasia ||
    lote.empresa?.razao_social ||
    "BrainX ERP";
  const nfLabel = lote.nota_entrada?.numero
    ? `NF ${lote.nota_entrada.numero}${
        lote.nota_entrada.serie ? `/${lote.nota_entrada.serie}` : ""
      }`
    : null;

  const folha = (
    <div
      className="etiqueta-folha w-[100mm] h-[150mm] border-2 border-black bg-white p-3 mx-auto flex flex-col text-black font-sans overflow-hidden print:border-0 print:m-0 print:shadow-none"
    >
      {/* Header empresa */}
      <div className="border-b-2 border-black pb-1.5 mb-2 text-center">
        <p className="text-[9px] font-bold uppercase tracking-wide truncate">
          {empresaNome}
        </p>
        <h1 className="text-base font-black uppercase tracking-tight leading-tight">
          Identificação de Insumo
        </h1>
        {nfLabel && (
          <p className="text-[10px] font-mono font-bold">{nfLabel}</p>
        )}
      </div>

      {/* Status */}
      <div
        className={`mb-2 px-1 py-1.5 text-center text-[11px] font-black uppercase tracking-wide ${faixa.classe}`}
      >
        {faixa.texto}
      </div>

      <div className="space-y-2 flex-1 min-h-0">
        <div>
          <label className="text-[9px] font-black uppercase text-gray-600">
            Insumo / Matéria-Prima
          </label>
          <p className="text-sm font-bold leading-tight line-clamp-3 uppercase">
            {lote.item.descricao_interna}
          </p>
          {lote.item.sku_interno && (
            <p className="text-[10px] font-mono">SKU: {lote.item.sku_interno}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-y-2 border-black py-1.5">
          <div>
            <label className="text-[9px] font-black uppercase text-gray-500">
              Lote Fornecedor
            </label>
            <p className="text-lg font-black font-mono leading-tight break-all">
              {lote.numero_lote}
            </p>
          </div>
          <div className="text-right">
            <label className="text-[9px] font-black uppercase text-gray-500">
              Quantidade
            </label>
            <p className="text-lg font-black leading-tight">
              {Number(lote.quantidade_original).toLocaleString("pt-BR")}{" "}
              {lote.unidade_original}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-black uppercase text-gray-700 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> Fabricação
            </label>
            <p className="text-sm font-bold">{fmtData(lote.data_fab)}</p>
          </div>
          <div className="text-right">
            <label className="text-[9px] font-black uppercase text-gray-700 flex items-center gap-1 justify-end">
              <Calendar className="h-2.5 w-2.5" /> Validade
            </label>
            <p className="text-base font-black underline decoration-2">
              {fmtData(lote.data_val)}
            </p>
          </div>
        </div>

        <div>
          <label className="text-[9px] font-black uppercase text-gray-700 flex items-center gap-1">
            <Truck className="h-2.5 w-2.5" /> Fornecedor
          </label>
          <p className="text-[11px] font-bold truncate uppercase">
            {lote.fornecedor?.razao_social || "Não informado"}
          </p>
        </div>

        {(lote.item.armazenamento || lote.item.texto_alerta_padrao) && (
          <div className="border border-black/40 rounded-sm p-1.5 space-y-0.5">
            {lote.item.armazenamento && (
              <p className="text-[10px] font-bold flex items-start gap-1">
                <Thermometer className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{lote.item.armazenamento}</span>
              </p>
            )}
            {lote.item.texto_alerta_padrao && (
              <p className="text-[9px] font-semibold uppercase line-clamp-2">
                ⚠ {lote.item.texto_alerta_padrao}
              </p>
            )}
          </div>
        )}
      </div>

      {/* QR + rodapé */}
      <div className="mt-auto pt-2 flex items-end justify-between gap-2 border-t-2 border-black">
        <div className="flex flex-col items-center gap-0.5">
          <QRCodeSVG
            value={lote.qr_url}
            size={96}
            level="M"
            includeMargin={false}
            className="border border-black p-0.5"
          />
          <span className="text-[7px] font-mono uppercase text-center max-w-[100px] break-all leading-tight">
            {lote.id.slice(0, 8)}…
          </span>
        </div>

        <div className="flex-1 space-y-1 text-right min-w-0">
          <div className="flex items-center gap-1 text-[8px] font-black justify-end">
            <Building2 className="h-2.5 w-2.5" />
            Rastreabilidade Digital
          </div>
          <div className="text-[9px] font-bold">
            Recebido: {fmtData(lote.recebido_em, true)}
          </div>
          {lote.empresa?.cnpj && (
            <div className="text-[8px] font-mono truncate">
              CNPJ {lote.empresa.cnpj}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (modoImpressao) return folha;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 print:hidden">
        <Button
          onClick={() => onImprimir?.()}
          variant="outline"
          size="sm"
          disabled={!onImprimir}
        >
          <Printer className="h-4 w-4 mr-2" /> Imprimir Etiqueta
        </Button>
      </div>
      {folha}
    </div>
  );
}
