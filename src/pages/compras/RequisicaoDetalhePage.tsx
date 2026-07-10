import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemCotacaoGrade } from '@/components/compras/ItemCotacaoGrade';
import { useRequisicaoCotacoes } from '@/hooks/use-requisicao-cotacoes';
import { labelStatus } from '@/lib/requisicoes-compra';
import { formatDate } from '@/lib/formatters';

export default function RequisicaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isLoadingInteligencia,
    isError,
    error,
  } = useRequisicaoCotacoes(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/compras/requisicoes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {(error as { message?: string })?.message || 'Requisição não encontrada'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { requisicao, itens } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/compras/requisicoes')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>

      <PageHeader
        title={`${requisicao.numero_interno || 'Requisição'} · ${labelStatus(requisicao.status)}`}
        description={
          <>
            {requisicao.ordens_producao_industrial?.codigo && (
              <>
                OP{' '}
                <Link
                  to={requisicao.op_id ? `/producao/ordens/${requisicao.op_id}` : '#'}
                  className="underline"
                >
                  {requisicao.ordens_producao_industrial.codigo}
                </Link>
                {' · '}
              </>
            )}
            Criada em {formatDate(requisicao.created_at)}
            <span className="block text-xs text-muted-foreground mt-1">
              Visualização somente leitura — edite cotações no{' '}
              <Link to="/compras/mapa" className="underline">
                Mapa de cotação
              </Link>
            </span>
          </>
        }
      />

      <div className="space-y-4">
        {itens.map(({ item, fornecedores, cotacoes, historicoItem }) => (
          <ItemCotacaoGrade
            key={item.id}
            gradeId={item.id}
            item={item}
            fornecedores={fornecedores}
            cotacoes={cotacoes}
            historicoItem={historicoItem}
            isLoadingInteligencia={isLoadingInteligencia}
            readOnly
          />
        ))}
      </div>
    </div>
  );
}
