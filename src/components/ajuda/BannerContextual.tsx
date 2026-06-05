import { useLocation } from 'react-router-dom';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';

const BANNERS: Record<string, {
  tipo: 'info' | 'aviso' | 'sucesso';
  titulo: string;
  texto: string;
}> = {
  '/producao/ordens/nova': {
    tipo: 'info',
    titulo: 'Dica de criação de OP',
    texto: 'Preencha o produto e a quantidade de frascos. A fórmula, os ingredientes e as tolerâncias serão carregados automaticamente.',
  },
  '/qualidade/desvios': {
    tipo: 'aviso',
    titulo: 'Atenção ao registrar desvios',
    texto: 'Desvios com severidade CRÍTICA bloqueiam automaticamente a OP vinculada e notificam o Responsável Técnico.',
  },
  '/responsaveis-tecnicos': {
    tipo: 'info',
    titulo: 'Como funciona a assinatura digital',
    texto: 'Ao assinar, o RT gera um hash SHA-256 que torna o documento imutável. O lote associado muda automaticamente de QUARENTENA para DISPONÍVEL.',
  },
  '/cadastros/produtos': {
    tipo: 'aviso',
    titulo: 'Prazo ANVISA: setembro/2026',
    texto: 'A RDC 990/2025 exige N° de Notificação ANVISA em todos os suplementos. Atualize seus produtos antes do prazo.',
  },
  '/estoque': {
    tipo: 'info',
    titulo: 'FEFO ativo no BrainxERP',
    texto: 'O sistema usa FEFO (First Expired, First Out): lotes com validade mais próxima são baixados primeiro automaticamente nas vendas.',
  },
};

export function BannerContextual() {
  const [fechados, setFechados] = useState<string[]>([]);
  const { pathname } = useLocation();

  const chave = Object.keys(BANNERS).find((k) => pathname.startsWith(k));
  if (!chave || fechados.includes(chave)) return null;

  const banner = BANNERS[chave];

  const cores = {
    info: { bg: 'bg-blue-50', borda: 'border-blue-200', texto: 'text-blue-800', Icone: Info },
    aviso: { bg: 'bg-amber-50', borda: 'border-amber-200', texto: 'text-amber-800', Icone: AlertTriangle },
    sucesso: { bg: 'bg-green-50', borda: 'border-green-200', texto: 'text-green-800', Icone: CheckCircle2 },
  };

  const { bg, borda, texto, Icone } = cores[banner.tipo];

  return (
    <div className={`${bg} border ${borda} rounded-lg px-4 py-2.5 mb-4 flex items-start gap-3`}>
      <Icone className={`w-4 h-4 mt-0.5 shrink-0 ${texto}`} />
      <div className="flex-1">
        <span className={`font-semibold text-sm ${texto}`}>{banner.titulo}: </span>
        <span className={`text-sm ${texto}`}>{banner.texto}</span>
      </div>
      <button
        onClick={() => setFechados((f) => [...f, chave])}
        className={`${texto} opacity-60 hover:opacity-100 shrink-0`}
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}