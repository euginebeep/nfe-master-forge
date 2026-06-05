// Guia interativo ativado automaticamente no primeiro acesso
// Mostra um passo-a-passo contextual de cada módulo

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronLeft, X, CheckCircle2 } from 'lucide-react';

const PASSOS = [
  {
    id: 'boas-vindas',
    titulo: '🎉 Bem-vindo ao BrainxERP!',
    descricao:
      'Você está no sistema de gestão industrial para fábricas de suplementos. Em 60 segundos você vai entender como tudo funciona.',
    rota: null as string | null,
    destaque: null as string | null,
  },
  {
    id: 'cadastros',
    titulo: '1. Primeiro: Cadastre seus produtos',
    descricao:
      'Antes de produzir, você precisa ter seus produtos cadastrados. Vá em Cadastros → Produtos e adicione o nome, código, NCM e fórmula de cada produto.',
    rota: '/cadastros/produtos' as string | null,
    destaque: 'Botão "Novo Produto" no canto superior direito' as string | null,
  },
  {
    id: 'nova-op',
    titulo: '2. Criar uma Ordem de Produção (OP)',
    descricao:
      'A OP é o coração do sistema. Ela registra tudo: o que vai ser produzido, quanto, quando, quem pesou, quem misturou. Vá em Produção → Ordens → Nova OP.',
    rota: '/producao/ordens',
    destaque: 'Botão azul "Nova OP"',
  },
  {
    id: 'pesagem',
    titulo: '3. Pesagem e Mistura',
    descricao:
      'Dentro da OP, você registra as pesagens de cada matéria-prima. O sistema já calcula as tolerâncias automaticamente. Atenção: Estearato de Magnésio sempre vai por ÚLTIMO.',
    rota: '/producao/ordens',
    destaque: 'Aba "Pesagem" dentro de uma OP aberta',
  },
  {
    id: 'rt-assina',
    titulo: '4. Responsável Técnico assina',
    descricao:
      'Após finalizar a produção, o Responsável Técnico (nutricionista ou farmacêutico) assina digitalmente a OP. Isso libera o lote de QUARENTENA para DISPONÍVEL no estoque.',
    rota: '/responsaveis-tecnicos',
    destaque: 'Menu "Responsáveis Técnicos" no sidebar',
  },
  {
    id: 'nfe',
    titulo: '5. Emitir Nota Fiscal (NF-e)',
    descricao:
      'Com o lote DISPONÍVEL, você pode vender e emitir a NF-e. Vá em Vendas → Notas de Saída → Nova NF-e. O sistema integra automaticamente com a SEFAZ.',
    rota: '/vendas/notas-saida',
    destaque: 'Botão "Nova NF-e"',
  },
  {
    id: 'qualidade',
    titulo: '6. Controle de Qualidade e BPF',
    descricao:
      'Em Qualidade você registra desvios, acessa os checklists BPF e os POPs. Desvios CRÍTICOS bloqueiam automaticamente a OP vinculada.',
    rota: '/qualidade',
    destaque: 'Menu "Qualidade" no sidebar',
  },
  {
    id: 'fim',
    titulo: '✅ Você está pronto!',
    descricao:
      'Sempre que tiver dúvidas, clique no botão azul ✨ no canto inferior direito. O Assistente BrainxERP responde qualquer pergunta em linguagem simples, 24 horas por dia.',
    rota: null,
    destaque: 'Botão azul flutuante no canto inferior direito',
  },
];

export function OnboardingWalkthrough() {
  const [ativo, setAtivo] = useState(false);
  const [passo, setPasso] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const visto = localStorage.getItem('brainx_onboarding_v1');
    if (!visto) setAtivo(true);
  }, []);

  const fechar = () => {
    localStorage.setItem('brainx_onboarding_v1', 'done');
    setAtivo(false);
  };

  const avancar = () => {
    if (passo < PASSOS.length - 1) {
      const proximo = PASSOS[passo + 1];
      if (proximo.rota) navigate(proximo.rota);
      setPasso((p) => p + 1);
    } else {
      fechar();
    }
  };

  const voltar = () => {
    if (passo > 0) {
      const anterior = PASSOS[passo - 1];
      if (anterior.rota) navigate(anterior.rota);
      setPasso((p) => p - 1);
    }
  };

  if (!ativo) return null;

  const passoAtual = PASSOS[passo];
  const progresso = (passo / (PASSOS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <button
          onClick={fechar}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Fechar tutorial"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Passo {passo + 1} de {PASSOS.length}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {Math.round(progresso)}%
            </span>
          </div>
          <Progress value={progresso} className="h-1.5" />
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-4 space-y-3">
          <h2 className="text-xl font-bold text-foreground">{passoAtual.titulo}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {passoAtual.descricao}
          </p>

          {passoAtual.destaque && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm text-primary font-medium">
                👉 Procure por: {passoAtual.destaque}
              </p>
            </div>
          )}

          {passoAtual.id === 'fim' && (
            <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                O tutorial fica salvo. Você pode refazê-lo em Configurações → Ajuda.
              </p>
            </div>
          )}
        </div>

        {/* Navegação */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={passo === 0 ? fechar : voltar}>
            {passo === 0 ? (
              'Pular tutorial'
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </>
            )}
          </Button>
          <Button size="sm" onClick={avancar}>
            {passo === PASSOS.length - 1 ? (
              <>
                Começar a usar
                <CheckCircle2 className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}