import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Etiqueta de identificação de insumo — 100 x 150 mm, impressora térmica.
 *
 * Regras de desenho para cabeça térmica:
 *  - sem áreas sólidas grandes (desgasta a cabeça e borra); usamos bordas
 *    grossas e hachura em vez de preenchimento cheio, exceto no BLOQUEADO,
 *    onde o alarme visual compensa;
 *  - fonte mínima 8pt — abaixo disso 203dpi não resolve;
 *  - QR com ~30mm e level M (H rouba área útil sem ganho real nesse tamanho);
 *  - nada depende de cor: a etiqueta é monocromática por definição.
 */

export type LoteEtiquetaStatus =
  | 'QUARENTENA'
  | 'DISPONIVEL'
  | 'APROVADO'
  | 'BLOQUEADO'
  | 'CONSUMIDO'
  | string;

export interface LoteEtiquetaData {
  id: string;
  numero_lote: string;
  status: LoteEtiquetaStatus;
  quantidade_original: number;
  unidade_original: string;
  data_fab?: string | null;
  data_val?: string | null;
  /** created_at do lote — data REAL de entrada, nunca new Date() */
  recebido_em: string;
  item: {
    descricao_interna: string;
    sku_interno?: string | null;
    armazenamento?: string | null;
    higroscopico?: boolean | null;
    controle_especial?: boolean | null;
    texto_alerta_padrao?: string | null;
  };
  fornecedor?: {
    razao_social: string;
    documento?: string | null;
  } | null;
  nota_entrada?: {
    numero?: string | null;
    serie?: string | null;
  } | null;
  empresa: {
    razao_social: string;
    nome_fantasia?: string | null;
    cnpj: string;
    licenca_sanitaria?: string | null;
  };
  qr_url: string;
}

interface Props {
  lote: LoteEtiquetaData;
  /** Esconde o botão quando renderizada dentro de uma folha de impressão em lote */
  hideActions?: boolean;
  /** Preferir o hook useImprimirEtiquetas (portal) em vez de window.print direto */
  onPrint?: () => void;
}

const STATUS_MAP: Record<string, { rotulo: string; enfase: 'normal' | 'hachura' | 'solido' }> = {
  QUARENTENA:  { rotulo: 'QUARENTENA — NÃO UTILIZAR', enfase: 'hachura' },
  DISPONIVEL:  { rotulo: 'LIBERADO PARA PRODUÇÃO',    enfase: 'normal'  },
  APROVADO:    { rotulo: 'LIBERADO PARA PRODUÇÃO',    enfase: 'normal'  },
  BLOQUEADO:   { rotulo: 'BLOQUEADO — NÃO UTILIZAR',  enfase: 'solido'  },
  CONSUMIDO:   { rotulo: 'CONSUMIDO',                 enfase: 'normal'  },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd/MM/yyyy');
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd/MM/yyyy HH:mm');
}

function formatarDoc(doc?: string | null) {
  if (!doc) return null;
  const n = doc.replace(/\D/g, '');
  if (n.length === 14) {
    return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

export function LoteFornecedorEtiqueta({ lote, hideActions = false, onPrint }: Props) {
  const status = STATUS_MAP[lote.status] ?? { rotulo: lote.status, enfase: 'normal' as const };

  const avisos: string[] = [];
  if (lote.item.higroscopico) avisos.push('HIGROSCÓPICO — manter recipiente fechado');
  if (lote.item.controle_especial) avisos.push('CONTROLE ESPECIAL');
  if (lote.item.texto_alerta_padrao) avisos.push(lote.item.texto_alerta_padrao);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-4">
      {!hideActions && (
        <div className="flex justify-end gap-2 print:hidden">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" /> Imprimir Etiqueta
          </Button>
        </div>
      )}

      <div className="etiqueta-lote">
        {/* ---------- Cabeçalho: quem recebeu ---------- */}
        <header className="et-header">
          <div className="et-empresa">
            {lote.empresa.nome_fantasia || lote.empresa.razao_social}
          </div>
          <div className="et-empresa-sub">
            CNPJ {formatarDoc(lote.empresa.cnpj)}
            {lote.empresa.licenca_sanitaria ? ` · Lic. Sanit. ${lote.empresa.licenca_sanitaria}` : ''}
          </div>
          <div className="et-titulo">IDENTIFICAÇÃO DE INSUMO</div>
        </header>

        {/* ---------- Status: o campo mais importante da etiqueta ---------- */}
        <div className={`et-status et-status--${status.enfase}`}>
          {status.rotulo}
        </div>

        {/* ---------- Insumo ---------- */}
        <section className="et-bloco">
          <span className="et-label">Insumo / Matéria-prima</span>
          <div className="et-insumo">{lote.item.descricao_interna}</div>
          {lote.item.sku_interno && (
            <div className="et-mono">SKU {lote.item.sku_interno}</div>
          )}
        </section>

        {/* ---------- Lote e quantidade ---------- */}
        <section className="et-grid et-borda-y">
          <div>
            <span className="et-label">Lote do fornecedor</span>
            <div className="et-destaque et-mono">{lote.numero_lote}</div>
          </div>
          <div className="et-right">
            <span className="et-label">Qtd. recebida</span>
            <div className="et-destaque">
              {Number(lote.quantidade_original).toLocaleString('pt-BR')} {lote.unidade_original}
            </div>
          </div>
        </section>

        {/* ---------- Datas ---------- */}
        <section className="et-grid">
          <div>
            <span className="et-label">Fabricação</span>
            <div className="et-data">{fmt(lote.data_fab)}</div>
          </div>
          <div className="et-right">
            <span className="et-label">Validade</span>
            <div className="et-data et-validade">{fmt(lote.data_val)}</div>
          </div>
        </section>

        {/* ---------- Origem ---------- */}
        <section className="et-bloco et-borda-t">
          <span className="et-label">Fornecedor</span>
          <div className="et-forn">{lote.fornecedor?.razao_social || 'Não informado'}</div>
          {lote.fornecedor?.documento && (
            <div className="et-mono">CNPJ {formatarDoc(lote.fornecedor.documento)}</div>
          )}
          <div className="et-linha-dupla">
            <span>
              NF entrada:{' '}
              <strong>
                {lote.nota_entrada?.numero
                  ? `${lote.nota_entrada.numero}${lote.nota_entrada.serie ? `/${lote.nota_entrada.serie}` : ''}`
                  : '—'}
              </strong>
            </span>
            <span>
              Recebido: <strong>{fmtDateTime(lote.recebido_em)}</strong>
            </span>
          </div>
        </section>

        {/* ---------- Armazenamento e advertências ---------- */}
        {(lote.item.armazenamento || avisos.length > 0) && (
          <section className="et-bloco et-borda-t">
            {lote.item.armazenamento && (
              <>
                <span className="et-label">Condições de armazenamento</span>
                <div className="et-armazen">{lote.item.armazenamento}</div>
              </>
            )}
            {avisos.length > 0 && (
              <div className="et-avisos">
                {avisos.map((a, i) => (
                  <div key={i}>! {a}</div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------- Rodapé: QR + conferente ---------- */}
        <footer className="et-footer">
          <div className="et-qr">
            <QRCodeSVG value={lote.qr_url} size={110} level="M" includeMargin={false} />
            <div className="et-qr-cap">RASTREABILIDADE</div>
          </div>
          <div className="et-assinatura">
            <div className="et-assin-linha">
              <span className="et-label">Conferente</span>
              <div className="et-risco" />
            </div>
            <div className="et-assin-linha">
              <span className="et-label">Data / visto</span>
              <div className="et-risco" />
            </div>
            <div className="et-rodape-nota">
              Etiqueta de controle interno. Não substitui o rótulo original do fabricante.
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        .etiqueta-lote {
          width: 100mm;
          height: 150mm;
          box-sizing: border-box;
          padding: 3mm;
          background: #fff;
          color: #000;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          font-family: "Helvetica Neue", Arial, sans-serif;
          margin: 0 auto;
          overflow: hidden;
        }
        .et-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 1mm; }
        .et-empresa { font-size: 11pt; font-weight: 800; text-transform: uppercase; line-height: 1.1; }
        .et-empresa-sub { font-size: 7.5pt; }
        .et-titulo { font-size: 8.5pt; font-weight: 800; letter-spacing: .5px; margin-top: .8mm; }

        .et-status {
          margin: 1.5mm 0;
          padding: 1.5mm 1mm;
          text-align: center;
          font-size: 11pt;
          font-weight: 900;
          letter-spacing: .3px;
          border: 2px solid #000;
        }
        .et-status--hachura {
          background: repeating-linear-gradient(
            45deg, #000 0, #000 1.2mm, #fff 1.2mm, #fff 3mm
          );
          -webkit-text-stroke: 0;
          text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff;
        }
        .et-status--solido { background: #000; color: #fff; }

        .et-label {
          display: block;
          font-size: 7pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .3px;
        }
        .et-bloco { margin: 1mm 0; }
        .et-borda-y { border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 1mm 0; }
        .et-borda-t { border-top: 1.5px solid #000; padding-top: 1mm; }
        .et-grid { display: flex; justify-content: space-between; gap: 2mm; margin: 1mm 0; }
        .et-right { text-align: right; }

        .et-insumo {
          font-size: 13pt; font-weight: 800; text-transform: uppercase;
          line-height: 1.1; max-height: 11mm; overflow: hidden;
        }
        .et-mono { font-size: 8pt; font-family: "Courier New", monospace; }
        .et-destaque { font-size: 14pt; font-weight: 900; line-height: 1.1; }
        .et-data { font-size: 11pt; font-weight: 700; }
        .et-validade { font-size: 14pt; font-weight: 900; text-decoration: underline; }
        .et-forn { font-size: 9pt; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
        .et-linha-dupla {
          display: flex; justify-content: space-between; gap: 2mm;
          font-size: 7.5pt; margin-top: .8mm;
        }
        .et-armazen { font-size: 8.5pt; font-weight: 600; line-height: 1.15; }
        .et-avisos { font-size: 8pt; font-weight: 800; margin-top: .8mm; line-height: 1.2; }

        .et-footer {
          margin-top: auto; padding-top: 1.5mm; border-top: 2px solid #000;
          display: flex; gap: 2mm; align-items: flex-start;
        }
        .et-qr { flex: 0 0 auto; text-align: center; }
        .et-qr-cap { font-size: 6.5pt; font-weight: 800; letter-spacing: .5px; }
        .et-assinatura { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; gap: 2mm; }
        .et-assin-linha { display: flex; flex-direction: column; }
        .et-risco { border-bottom: 1px solid #000; height: 5mm; }
        .et-rodape-nota { font-size: 6.5pt; line-height: 1.15; margin-top: auto; }

        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          .etiqueta-lote {
            border: none;
            width: 100mm;
            height: 150mm;
            page-break-after: always;
            break-after: page;
          }
          .etiqueta-lote:last-of-type { page-break-after: auto; break-after: auto; }
          /* garante que hachura e status sólido saiam na térmica */
          .et-status--hachura, .et-status--solido {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
