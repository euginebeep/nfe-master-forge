import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { formatDate, normalizarQtdExibicao } from '@/lib/formatters';

/**
 * Etiqueta de identificação de insumo — 100 x 150 mm, impressora térmica.
 *
 * v2 (22/07/2026):
 *  - QUANTIDADE: passa a usar quantidade_interna/unidade_interna.
 *    unidade_original vem do ucom do XML da NF-e e em ~15% dos lotes traz o
 *    TAMANHO DA EMBALAGEM, não a unidade ("25 KG", "500 G"). Combinado com
 *    quantidade_original (= nº de embalagens), a v1 imprimia "1" + "25 KG",
 *    lido como 1,25 kg num tambor de 25 kg. Erro de 20x em pesagem.
 *    A embalagem virou linha secundária, informativa.
 *  - Numerais tabulares e unidade separada do número, para não colar dígitos.
 *  - QR passou a explicar o que faz.
 *  - Rodapé com identificação do BrainX ERP.
 *
 * Regras de desenho para cabeça térmica:
 *  - sem áreas sólidas grandes (desgasta a cabeça e borra); bordas grossas e
 *    hachura em vez de preenchimento cheio, exceto no BLOQUEADO;
 *  - fonte mínima 8pt — abaixo disso 203dpi não resolve;
 *  - QR ~28mm, level M;
 *  - nada depende de cor: a etiqueta é monocromática.
 */

export type LoteEtiquetaStatus =
  | 'QUARENTENA' | 'DISPONIVEL' | 'APROVADO' | 'BLOQUEADO' | 'CONSUMIDO' | string;

export interface LoteEtiquetaData {
  id: string;
  numero_lote: string;
  status: LoteEtiquetaStatus;
  /** quantidade normalizada (estoque_lotes.quantidade_interna) */
  quantidade: number;
  /** unidade normalizada (estoque_lotes.unidade_interna) */
  unidade: string;
  /** embalagem conforme NF-e — informativo */
  embalagem_qtd?: number | null;
  embalagem_unidade?: string | null;
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
  fornecedor?: { razao_social: string; documento?: string | null } | null;
  nota_entrada?: { numero?: string | null; serie?: string | null } | null;
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
  hideActions?: boolean;
}

const STATUS_MAP: Record<string, { rotulo: string; enfase: 'normal' | 'hachura' | 'solido' }> = {
  QUARENTENA: { rotulo: 'QUARENTENA — NÃO UTILIZAR', enfase: 'hachura' },
  DISPONIVEL: { rotulo: 'LIBERADO PARA PRODUÇÃO', enfase: 'normal' },
  APROVADO:   { rotulo: 'LIBERADO PARA PRODUÇÃO', enfase: 'normal' },
  BLOQUEADO:  { rotulo: 'BLOQUEADO — NÃO UTILIZAR', enfase: 'solido' },
  CONSUMIDO:  { rotulo: 'CONSUMIDO', enfase: 'normal' },
};

/**
 * Datas `date` do Postgres chegam como "YYYY-MM-DD". `new Date("2027-08-30")`
 * parseia como MEIA-NOITE UTC; em São Paulo (UTC-3) vira 21h do dia anterior,
 * e a etiqueta imprimiria a validade um dia adiantada.
 * `formatDate` de @/lib/formatters já trata isso por troca de string —
 * usamos o helper do projeto em vez de reimplementar.
 */
function fmt(d?: string | null) {
  return d ? formatDate(d) : '—';
}

/** recebido_em é timestamptz: aqui a conversão para local É o correto. */
function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  const p = new Date(d);
  return isNaN(p.getTime()) ? '—' : format(p, 'dd/MM/yyyy HH:mm');
}

/** Número sem casas decimais inúteis: 25,0000 -> "25" | 1,2500 -> "1,25" */
function fmtNum(n: number) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatarDoc(doc?: string | null) {
  if (!doc) return null;
  const n = doc.replace(/\D/g, '');
  return n.length === 14
    ? n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    : doc;
}

export function LoteFornecedorEtiqueta({ lote, hideActions = false }: Props) {
  const status = STATUS_MAP[lote.status] ?? { rotulo: lote.status, enfase: 'normal' as const };

  const avisos: string[] = [];
  if (lote.item.higroscopico) avisos.push('HIGROSCÓPICO — manter fechado');
  if (lote.item.controle_especial) avisos.push('CONTROLE ESPECIAL');
  if (lote.item.texto_alerta_padrao) avisos.push(lote.item.texto_alerta_padrao);

  // só mostra a embalagem se ela agregar informação
  const mostrarEmbalagem =
    lote.embalagem_qtd != null &&
    lote.embalagem_unidade &&
    `${fmtNum(lote.embalagem_qtd)} ${lote.embalagem_unidade}`.toLowerCase() !==
      `${fmtNum(lote.quantidade)} ${lote.unidade}`.toLowerCase();

  return (
    <div className="space-y-4">
      {!hideActions && (
        <div className="flex justify-end gap-2 print:hidden">
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" /> Imprimir Etiqueta
          </Button>
        </div>
      )}

      <div className="etiqueta-lote">
        {/* Cabeçalho SEMPRE renderizado. Sem optional chaining a etiqueta
            quebraria com empresa ausente; sem fallback o bloco colapsaria e
            a altura da etiqueta mudaria entre impressões. */}
        <header className="et-header">
          <div className="et-empresa">
            {lote.empresa?.nome_fantasia || lote.empresa?.razao_social || '—'}
          </div>
          <div className="et-empresa-sub">
            {lote.empresa?.cnpj ? `CNPJ ${formatarDoc(lote.empresa.cnpj)}` : '\u00A0'}
            {lote.empresa?.licenca_sanitaria
              ? ` · Lic. Sanit. ${lote.empresa.licenca_sanitaria}`
              : ''}
          </div>
          <div className="et-titulo">IDENTIFICAÇÃO DE INSUMO</div>
        </header>

        <div className={`et-status et-status--${status.enfase}`}>{status.rotulo}</div>

        <section className="et-bloco">
          <span className="et-label">Insumo / Matéria-prima</span>
          <div className="et-insumo">{lote.item.descricao_interna}</div>
          {lote.item.sku_interno && <div className="et-mono">SKU {lote.item.sku_interno}</div>}
        </section>

        {/* Lote e quantidade — numeral e unidade separados */}
        <section className="et-grid et-borda-y">
          <div>
            <span className="et-label">Lote do fornecedor</span>
            <div className="et-lote">{lote.numero_lote}</div>
          </div>
          <div className="et-right">
            <span className="et-label">Quantidade</span>
            <div className="et-qtd">
              {(() => {
                const q = normalizarQtdExibicao(Number(lote.quantidade), lote.unidade);
                return (
                  <>
                    <span className="et-qtd-num">
                      {q.valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                    </span>{' '}
                    <span className="et-qtd-un">{q.unidade}</span>
                  </>
                );
              })()}
            </div>
            {mostrarEmbalagem && (
              <div className="et-emb">
                {fmtNum(lote.embalagem_qtd!)} × {lote.embalagem_unidade} (NF)
              </div>
            )}
          </div>
        </section>

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
            <span>Recebido: <strong>{fmtDateTime(lote.recebido_em)}</strong></span>
          </div>
        </section>

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
                {avisos.map((a, i) => <div key={i}>! {a}</div>)}
              </div>
            )}
          </section>
        )}

        <footer className="et-footer">
          <div className="et-qr">
            <QRCodeSVG value={lote.qr_url} size={104} level="M" includeMargin={false} />
          </div>
          <div className="et-qr-lado">
            <div className="et-qr-titulo">FICHA COMPLETA DO LOTE</div>
            <div className="et-qr-txt">
              Aponte a câmera do celular para o código e toque no link.
              Mostra origem, laudo e histórico deste lote.
            </div>
            <div className="et-assin-linha">
              <span className="et-label">Conferente</span>
              <div className="et-risco" />
            </div>
            <div className="et-assin-linha">
              <span className="et-label">Data / visto</span>
              <div className="et-risco" />
            </div>
          </div>
        </footer>

        <div className="et-rodape">
          <strong>BrainX ERP</strong> · brainxerp.com
          <br />
          Etiqueta de controle interno. Não substitui o rótulo original do fabricante.
        </div>
      </div>

      <style>{`
        .etiqueta-lote {
          width: 100mm; height: 150mm; box-sizing: border-box; padding: 3mm;
          background: #fff; color: #000; border: 1px solid #000;
          display: flex; flex-direction: column;
          font-family: "Helvetica Neue", Arial, sans-serif;
          font-variant-numeric: tabular-nums lining-nums;
          margin: 0 auto; overflow: hidden;
        }
        .et-header { text-align:center; border-bottom:2px solid #000; padding-bottom:1mm; min-height:15mm; }
        .et-empresa { font-size: 11pt; font-weight: 800; text-transform: uppercase; line-height: 1.1; }
        .et-empresa-sub { font-size: 7.5pt; }
        .et-titulo { font-size: 8.5pt; font-weight: 800; letter-spacing: .5px; margin-top: .8mm; }

        .et-status {
          margin: 1.5mm 0; padding: 1.5mm 1mm; text-align: center;
          font-size: 11pt; font-weight: 900; letter-spacing: .3px; border: 2px solid #000;
        }
        .et-status--hachura {
          background: repeating-linear-gradient(45deg,#000 0,#000 1.2mm,#fff 1.2mm,#fff 3mm);
          text-shadow: 0 0 2px #fff,0 0 2px #fff,0 0 2px #fff,0 0 2px #fff;
        }
        .et-status--solido { background: #000; color: #fff; }

        .et-label { display:block; font-size:7pt; font-weight:800; text-transform:uppercase; letter-spacing:.3px; }
        .et-bloco { margin: 1mm 0; }
        .et-borda-y { border-top:1.5px solid #000; border-bottom:1.5px solid #000; padding:1mm 0; }
        .et-borda-t { border-top:1.5px solid #000; padding-top:1mm; }
        .et-grid { display:flex; justify-content:space-between; gap:2mm; margin:1mm 0; }
        .et-right { text-align:right; }

        .et-insumo {
          font-size:13pt; font-weight:800; text-transform:uppercase;
          line-height:1.1; max-height:11mm; overflow:hidden;
        }
        .et-mono { font-size:8pt; font-family:"Courier New",monospace; }

        /* lote: mono + espaçamento, para não confundir 0/O e 1/I */
        .et-lote {
          font-size:14pt; font-weight:700; font-family:"Courier New",monospace;
          letter-spacing:.6px; line-height:1.1;
        }
        /* quantidade: numeral grande, unidade menor e destacada do número */
        .et-qtd { display:flex; align-items:baseline; justify-content:flex-end; gap:1.2mm; line-height:1.1; }
        .et-qtd-num { font-size:20pt; font-weight:900; }
        .et-qtd-un  { font-size:10pt; font-weight:700; text-transform:lowercase; }
        .et-emb { font-size:7pt; font-weight:600; }

        .et-data { font-size:11pt; font-weight:700; }
        .et-validade { font-size:14pt; font-weight:900; text-decoration:underline; }
        .et-forn { font-size:9pt; font-weight:700; text-transform:uppercase; line-height:1.1; }
        .et-linha-dupla { display:flex; justify-content:space-between; gap:2mm; font-size:7.5pt; margin-top:.8mm; }
        .et-armazen { font-size:8.5pt; font-weight:600; line-height:1.15; }
        .et-avisos { font-size:8pt; font-weight:800; margin-top:.8mm; line-height:1.2; }

        .et-footer {
          margin-top:auto; padding-top:1.5mm; border-top:2px solid #000;
          display:flex; gap:2.5mm; align-items:flex-start;
        }
        .et-qr { flex:0 0 auto; }
        .et-qr-lado { flex:1; display:flex; flex-direction:column; gap:1.2mm; }
        .et-qr-titulo { font-size:8pt; font-weight:900; letter-spacing:.3px; }
        .et-qr-txt { font-size:7pt; line-height:1.2; }
        .et-assin-linha { display:flex; flex-direction:column; }
        .et-risco { border-bottom:1px solid #000; height:4mm; }

        .et-rodape {
          margin-top:1.2mm; padding-top:1mm; border-top:1px solid #000;
          font-size:6.5pt; line-height:1.2; text-align:center;
        }

        @media print {
          /* O tamanho do papel no driver PRECISA ser 100x150mm e a escala
             do diálogo em 100% (não "ajustar à página"), senão o Chrome
             redimensiona e o conteúdo é cortado. */
          @page { size: 100mm 150mm; margin: 0; }
          html, body { width: 100mm; }
          .etiqueta-lote {
            border:none; width:100mm; height:150mm;
            page-break-after: always; break-after: page;
          }
          .etiqueta-lote:last-of-type { page-break-after: auto; break-after: auto; }
          .et-status--hachura, .et-status--solido {
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
