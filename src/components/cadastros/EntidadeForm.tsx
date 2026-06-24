import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useEntidadeUpsert, EntidadeStatus } from '@/hooks/use-entidade-upsert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// Schema de validação
const entidadeSchema = z.object({
  documento: z.string()
    .min(14, 'CNPJ deve ter 14 dígitos')
    .max(14, 'CNPJ deve ter 14 dígitos')
    .regex(/^\d+$/, 'CNPJ deve conter apenas números'),
  razao_social: z.string()
    .min(3, 'Razão social deve ter no mínimo 3 caracteres')
    .max(255, 'Razão social muito longa'),
  nome_fantasia: z.string().optional(),
  ie: z.string().optional(),
  im: z.string().optional(),
  cnae: z.string().optional(),
  crt: z.string().optional(),
  site: z.string().url('URL inválida').optional().or(z.literal('')),
});

type EntidadeFormData = z.infer<typeof entidadeSchema>;

interface EntidadeFormProps {
  companyId: string;
  initialData?: Partial<EntidadeFormData> & { id?: string };
  onSuccess?: (entidadeId: string) => void;
  onCancel?: () => void;
}

/**
 * Componente para cadastro/atualização segura de entidades
 * Implementa validação de duplicação e workflow de status
 */
export function EntidadeForm({
  companyId,
  initialData,
  onSuccess,
  onCancel,
}: EntidadeFormProps) {
  const { upsert, checkDuplicate, loading, error } = useEntidadeUpsert();
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<EntidadeFormData>({
    resolver: zodResolver(entidadeSchema),
    defaultValues: initialData || {},
  });

  const documento = watch('documento');

  // Verificar duplicação quando CNPJ mudar
  useEffect(() => {
    if (!documento || documento.length < 14) {
      setIsDuplicate(false);
      setDuplicateWarning(null);
      return;
    }

    const checkForDuplicate = async () => {
      const hasDuplicate = await checkDuplicate(documento, companyId);
      if (hasDuplicate && initialData?.id) {
        // Se é atualização, verificar se é o mesmo registro
        setIsDuplicate(false);
        setDuplicateWarning(null);
      } else if (hasDuplicate) {
        // Se é novo registro e já existe
        setIsDuplicate(true);
        setDuplicateWarning(
          `CNPJ ${documento} já está cadastrado neste tenant. ` +
          'Você será redirecionado para atualizar o registro existente.'
        );
      } else {
        setIsDuplicate(false);
        setDuplicateWarning(null);
      }
    };

    const timer = setTimeout(checkForDuplicate, 500); // Debounce
    return () => clearTimeout(timer);
  }, [documento, companyId, checkDuplicate, initialData?.id]);

  const onSubmit = async (data: EntidadeFormData) => {
    if (isDuplicate && !initialData?.id) {
      // Não permitir criar novo se já existe
      return;
    }

    const result = await upsert({
      id: initialData?.id,
      documento: data.documento,
      company_id: companyId,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      ie: data.ie,
      im: data.im,
      cnae: data.cnae,
      crt: data.crt,
      site: data.site,
      status: initialData?.id ? undefined : 'PENDENTE_CERTIFICADO',
    });

    if (result.success && result.entidade_id) {
      reset();
      onSuccess?.(result.entidade_id);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialData?.id ? 'Atualizar Entidade' : 'Cadastrar Nova Entidade'}
        </CardTitle>
        <CardDescription>
          Preencha os dados da empresa. O CNPJ é único por tenant.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Aviso de Duplicação */}
          {duplicateWarning && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                {duplicateWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Aviso de Erro */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* CNPJ */}
          <div className="space-y-2">
            <Label htmlFor="documento">
              CNPJ *
              {!isDuplicate && documento && documento.length === 14 && (
                <CheckCircle2 className="ml-2 inline h-4 w-4 text-green-600" />
              )}
            </Label>
            <Input
              id="documento"
              placeholder="00000000000000"
              maxLength={14}
              {...register('documento')}
              className={errors.documento ? 'border-red-500' : ''}
              disabled={loading || isSubmitting}
            />
            {errors.documento && (
              <p className="text-sm text-red-600">{errors.documento.message}</p>
            )}
          </div>

          {/* Razão Social */}
          <div className="space-y-2">
            <Label htmlFor="razao_social">Razão Social *</Label>
            <Input
              id="razao_social"
              placeholder="Empresa LTDA"
              {...register('razao_social')}
              className={errors.razao_social ? 'border-red-500' : ''}
              disabled={loading || isSubmitting}
            />
            {errors.razao_social && (
              <p className="text-sm text-red-600">{errors.razao_social.message}</p>
            )}
          </div>

          {/* Nome Fantasia */}
          <div className="space-y-2">
            <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
            <Input
              id="nome_fantasia"
              placeholder="Empresa"
              {...register('nome_fantasia')}
              disabled={loading || isSubmitting}
            />
          </div>

          {/* IE */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ie">Inscrição Estadual</Label>
              <Input
                id="ie"
                placeholder="123456789012"
                {...register('ie')}
                disabled={loading || isSubmitting}
              />
            </div>

            {/* IM */}
            <div className="space-y-2">
              <Label htmlFor="im">Inscrição Municipal</Label>
              <Input
                id="im"
                placeholder="123456"
                {...register('im')}
                disabled={loading || isSubmitting}
              />
            </div>
          </div>

          {/* CNAE */}
          <div className="space-y-2">
            <Label htmlFor="cnae">CNAE</Label>
            <Input
              id="cnae"
              placeholder="1234-5/67"
              {...register('cnae')}
              disabled={loading || isSubmitting}
            />
          </div>

          {/* CRT */}
          <div className="space-y-2">
            <Label htmlFor="crt">CRT (Código de Regime Tributário)</Label>
            <Input
              id="crt"
              placeholder="1"
              {...register('crt')}
              disabled={loading || isSubmitting}
            />
          </div>

          {/* Site */}
          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input
              id="site"
              type="url"
              placeholder="https://www.empresa.com.br"
              {...register('site')}
              className={errors.site ? 'border-red-500' : ''}
              disabled={loading || isSubmitting}
            />
            {errors.site && (
              <p className="text-sm text-red-600">{errors.site.message}</p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={loading || isSubmitting || (isDuplicate && !initialData?.id)}
              className="flex-1"
            >
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              {initialData?.id ? 'Atualizar' : 'Cadastrar'}
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading || isSubmitting}
              >
                Cancelar
              </Button>
            )}
          </div>

          {/* Status Info */}
          <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold mb-2">Status da Entidade:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>PENDENTE_CERTIFICADO:</strong> Aguardando certificado digital
              </li>
              <li>
                <strong>CERTIFICADO_VALIDADO:</strong> Certificado adicionado
              </li>
              <li>
                <strong>DADOS_COMPLETOS:</strong> Todos os dados preenchidos
              </li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
