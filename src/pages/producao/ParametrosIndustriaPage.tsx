import { useState, useEffect } from 'react';
import { useConfigCustosProducao } from '@/hooks/use-custo-industrial';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, Package, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ItemComplemento {
  id: string;
  descricao_interna: string;
  tipo_item: string;
  custo_por_unidade_interna: number;
  unidade_interna: string;
}

interface FormData {
  custo_hora_operador: number;
  custo_hora_tecnico: number;
  custo_overhead_hora: number;
  percentual_overhead: number;
  percentual_perda_padrao: number;
  capsula_padrao_id: string | null;
  pote_padrao_id: string | null;
  tampa_padrao_id: string | null;
  rotulo_padrao_id: string | null;
  lacre_padrao_id: string | null;
}

export default function ParametrosIndustriaPage() {
  const { config, loading, updateConfig } = useConfigCustosProducao();
  const [formData, setFormData] = useState<FormData>({
    custo_hora_operador: 0,
    custo_hora_tecnico: 0,
    custo_overhead_hora: 0,
    percentual_overhead: 0,
    percentual_perda_padrao: 0,
    capsula_padrao_id: null,
    pote_padrao_id: null,
    tampa_padrao_id: null,
    rotulo_padrao_id: null,
    lacre_padrao_id: null,
  });

  const [itens, setItens] = useState<Record<string, ItemComplemento[]>>({
    CAPSULA_VAZIA: [],
    POTE: [],
    TAMPA: [],
    EMBALAGEM: [],
  });

  const [precosSelecionados, setPrecosSelecionados] = useState<Record<string, ItemComplemento | null>>({
    capsula_padrao_id: null,
    pote_padrao_id: null,
    tampa_padrao_id: null,
    rotulo_padrao_id: null,
    lacre_padrao_id: null,
  });

  const [saving, setSaving] = useState(false);
  const [excipientes, setExcipientes] = useState<any[]>([]);
  const [dialogExcipiente, setDialogExcipiente] = useState(false);
  const [editandoExcipiente, setEditandoExcipiente] = useState<any>(null);
  const [formExcipiente, setFormExcipiente] = useState({
    nome: '',
    categoria: 'EXCIPIENTE_TECNOLOGICO',
    funcao: '',
    percentual: 0,
    ordem: 0,
    adicionar_por_ultimo: false,
    ativo: true,
    item_id: '',
  });

  // Carregar excipientes
  useEffect(() => {
    const carregarExcipientes = async () => {
      const { data } = await supabase
        .from('op_excipientes_config')
        .select('*')
        .order('ordem', { ascending: true });
      if (data) setExcipientes(data);
    };
    carregarExcipientes();
  }, []);

  // Salvar excipiente
  const handleSalvarExcipiente = async () => {
    if (!formExcipiente.nome || !formExcipiente.item_id) {
      toast.error('Preencha nome e item');
      return;
    }
    if (formExcipiente.categoria === 'EXCIPIENTE_BASE' && formExcipiente.ativo) {
      const temOutraBase = excipientes.some(
        e => e.categoria === 'EXCIPIENTE_BASE' && e.ativo && e.id !== editandoExcipiente?.id
      );
      if (temOutraBase) {
        toast.error('Já existe uma base ativa.');
        return;
      }
    }
    try {
      if (editandoExcipiente) {
        await supabase.from('op_excipientes_config').update(formExcipiente).eq('id', editandoExcipiente.id);
      } else {
        await supabase.from('op_excipientes_config').insert([formExcipiente]);
      }
      toast.success('Salvo com sucesso');
      setDialogExcipiente(false);
      setEditandoExcipiente(null);
      const { data } = await supabase.from('op_excipientes_config').select('*').order('ordem', { ascending: true });
      if (data) setExcipientes(data);
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const handleDeletarExcipiente = async (id: string) => {
    if (!confirm('Deletar?')) return;
    await supabase.from('op_excipientes_config').delete().eq('id', id);
    setExcipientes(excipientes.filter(e => e.id !== id));
  };

  // Carregar config inicial
  useEffect(() => {
    if (config) {
      setFormData({
        custo_hora_operador: config.custo_hora_operador || 0,
        custo_hora_tecnico: config.custo_hora_tecnico || 0,
        custo_overhead_hora: config.custo_overhead_hora || 0,
        percentual_overhead: config.percentual_overhead || 0,
        percentual_perda_padrao: config.percentual_perda_padrao || 0,
        capsula_padrao_id: config.capsula_padrao_id || null,
        pote_padrao_id: config.pote_padrao_id || null,
        tampa_padrao_id: config.tampa_padrao_id || null,
        rotulo_padrao_id: config.rotulo_padrao_id || null,
        lacre_padrao_id: config.lacre_padrao_id || null,
      });
    }
  }, [config]);

  // Buscar itens de complementos
  useEffect(() => {
    const buscarItens = async () => {
      const tiposItem = ['CAPSULA_VAZIA', 'POTE', 'TAMPA', 'EMBALAGEM'];
      const novoItens: Record<string, ItemComplemento[]> = {};

      for (const tipo of tiposItem) {
        const { data, error } = await supabase
          .from('itens')
          .select('id, descricao_interna, tipo_item, custo_por_unidade_interna, unidade_interna')
          .eq('tipo_item', tipo)
          .order('descricao_interna');

        if (error) {
          console.error(`Erro ao buscar itens ${tipo}:`, error);
          novoItens[tipo] = [];
        } else {
          novoItens[tipo] = (data || []) as ItemComplemento[];
        }
      }

      setItens(novoItens);

      // Carregar preços dos itens selecionados
      const idsParaBuscar = [
        formData.capsula_padrao_id,
        formData.pote_padrao_id,
        formData.tampa_padrao_id,
        formData.rotulo_padrao_id,
        formData.lacre_padrao_id,
      ].filter(Boolean) as string[];

      if (idsParaBuscar.length > 0) {
        const { data: itensData } = await supabase
          .from('itens')
          .select('id, descricao_interna, tipo_item, custo_por_unidade_interna, unidade_interna')
          .in('id', idsParaBuscar);

        if (itensData) {
          const mapaPrecos: Record<string, ItemComplemento | null> = {
            capsula_padrao_id: null,
            pote_padrao_id: null,
            tampa_padrao_id: null,
            rotulo_padrao_id: null,
            lacre_padrao_id: null,
          };

          itensData.forEach((item) => {
            if (item.id === formData.capsula_padrao_id) mapaPrecos.capsula_padrao_id = item;
            if (item.id === formData.pote_padrao_id) mapaPrecos.pote_padrao_id = item;
            if (item.id === formData.tampa_padrao_id) mapaPrecos.tampa_padrao_id = item;
            if (item.id === formData.rotulo_padrao_id) mapaPrecos.rotulo_padrao_id = item;
            if (item.id === formData.lacre_padrao_id) mapaPrecos.lacre_padrao_id = item;
          });

          setPrecosSelecionados(mapaPrecos);
        }
      }
    };

    buscarItens();
  }, [formData.capsula_padrao_id, formData.pote_padrao_id, formData.tampa_padrao_id, formData.rotulo_padrao_id, formData.lacre_padrao_id]);

  const handleNumericChange = (field: keyof FormData, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData((prev) => ({ ...prev, [field]: numValue }));
  };

  const handleSelectChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value || null }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Gravar versão anterior (snapshot)
      if (config) {
        const { error: versionError } = await supabase
          .from('versoes_parametros_industriais')
          .insert({
            config_id: config.id,
            valores_anteriores: {
              custo_hora_operador: config.custo_hora_operador,
              custo_hora_tecnico: config.custo_hora_tecnico,
              custo_overhead_hora: config.custo_overhead_hora,
              percentual_overhead: config.percentual_overhead,
              percentual_perda_padrao: config.percentual_perda_padrao,
              capsula_padrao_id: config.capsula_padrao_id,
              pote_padrao_id: config.pote_padrao_id,
              tampa_padrao_id: config.tampa_padrao_id,
              rotulo_padrao_id: config.rotulo_padrao_id,
              lacre_padrao_id: config.lacre_padrao_id,
            },
            alterado_por: (await supabase.auth.getUser()).data.user?.id,
          });

        if (versionError) {
          console.error('Erro ao gravar versão:', versionError);
        }
      }

      // Atualizar configuração
      await updateConfig({
        custo_hora_operador: formData.custo_hora_operador,
        custo_hora_tecnico: formData.custo_hora_tecnico,
        custo_overhead_hora: formData.custo_overhead_hora,
        percentual_overhead: formData.percentual_overhead,
        percentual_perda_padrao: formData.percentual_perda_padrao,
        capsula_padrao_id: formData.capsula_padrao_id,
        pote_padrao_id: formData.pote_padrao_id,
        tampa_padrao_id: formData.tampa_padrao_id,
        rotulo_padrao_id: formData.rotulo_padrao_id,
        lacre_padrao_id: formData.lacre_padrao_id,
      });

      toast.success('Parâmetros salvos com sucesso');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar parâmetros');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Parâmetros de Indústria"
        description="Configure custos e complementos padrão para produção"
        icon={Settings}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* SEÇÃO A: Custos que NÃO são insumo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custos Operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="custo_hora_operador">Custo-hora Operador (R$/h)</Label>
              <Input
                id="custo_hora_operador"
                type="number"
                step="0.01"
                value={formData.custo_hora_operador}
                onChange={(e) => handleNumericChange('custo_hora_operador', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="custo_hora_tecnico">Custo-hora Técnico (R$/h)</Label>
              <Input
                id="custo_hora_tecnico"
                type="number"
                step="0.01"
                value={formData.custo_hora_tecnico}
                onChange={(e) => handleNumericChange('custo_hora_tecnico', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="custo_overhead_hora">Overhead por hora (R$/h)</Label>
              <Input
                id="custo_overhead_hora"
                type="number"
                step="0.01"
                value={formData.custo_overhead_hora}
                onChange={(e) => handleNumericChange('custo_overhead_hora', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="percentual_overhead">Overhead (%)</Label>
              <Input
                id="percentual_overhead"
                type="number"
                step="0.01"
                value={formData.percentual_overhead}
                onChange={(e) => handleNumericChange('percentual_overhead', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="percentual_perda_padrao">Perda padrão (%)</Label>
              <Input
                id="percentual_perda_padrao"
                type="number"
                step="0.01"
                value={formData.percentual_perda_padrao}
                onChange={(e) => handleNumericChange('percentual_perda_padrao', e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* SEÇÃO B: Complementos padrão */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Complementos Padrão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cápsula padrão */}
            <div>
              <Label htmlFor="capsula_padrao_id">Cápsula padrão</Label>
              <Select
                value={formData.capsula_padrao_id || ''}
                onValueChange={(value) => handleSelectChange('capsula_padrao_id', value)}
              >
                <SelectTrigger id="capsula_padrao_id" className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {itens.CAPSULA_VAZIA.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.descricao_interna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precosSelecionados.capsula_padrao_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {precosSelecionados.capsula_padrao_id.custo_por_unidade_interna.toFixed(2)} / {precosSelecionados.capsula_padrao_id.unidade_interna}
                </p>
              )}
              {formData.capsula_padrao_id && !precosSelecionados.capsula_padrao_id && (
                <p className="text-xs text-amber-600 mt-1">sem preço — atualize via NF-e</p>
              )}
            </div>

            {/* Pote padrão */}
            <div>
              <Label htmlFor="pote_padrao_id">Pote padrão</Label>
              <Select
                value={formData.pote_padrao_id || ''}
                onValueChange={(value) => handleSelectChange('pote_padrao_id', value)}
              >
                <SelectTrigger id="pote_padrao_id" className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {itens.POTE.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.descricao_interna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precosSelecionados.pote_padrao_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {precosSelecionados.pote_padrao_id.custo_por_unidade_interna.toFixed(2)} / {precosSelecionados.pote_padrao_id.unidade_interna}
                </p>
              )}
              {formData.pote_padrao_id && !precosSelecionados.pote_padrao_id && (
                <p className="text-xs text-amber-600 mt-1">sem preço — atualize via NF-e</p>
              )}
            </div>

            {/* Tampa padrão */}
            <div>
              <Label htmlFor="tampa_padrao_id">Tampa padrão</Label>
              <Select
                value={formData.tampa_padrao_id || ''}
                onValueChange={(value) => handleSelectChange('tampa_padrao_id', value)}
              >
                <SelectTrigger id="tampa_padrao_id" className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {itens.TAMPA.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.descricao_interna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precosSelecionados.tampa_padrao_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {precosSelecionados.tampa_padrao_id.custo_por_unidade_interna.toFixed(2)} / {precosSelecionados.tampa_padrao_id.unidade_interna}
                </p>
              )}
              {formData.tampa_padrao_id && !precosSelecionados.tampa_padrao_id && (
                <p className="text-xs text-amber-600 mt-1">sem preço — atualize via NF-e</p>
              )}
            </div>

            {/* Rótulo padrão */}
            <div>
              <Label htmlFor="rotulo_padrao_id">Rótulo padrão</Label>
              <Select
                value={formData.rotulo_padrao_id || ''}
                onValueChange={(value) => handleSelectChange('rotulo_padrao_id', value)}
              >
                <SelectTrigger id="rotulo_padrao_id" className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {itens.EMBALAGEM.filter((item) => item.descricao_interna?.toLowerCase().includes('rótulo')).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.descricao_interna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precosSelecionados.rotulo_padrao_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {precosSelecionados.rotulo_padrao_id.custo_por_unidade_interna.toFixed(2)} / {precosSelecionados.rotulo_padrao_id.unidade_interna}
                </p>
              )}
              {formData.rotulo_padrao_id && !precosSelecionados.rotulo_padrao_id && (
                <p className="text-xs text-amber-600 mt-1">sem preço — atualize via NF-e</p>
              )}
            </div>

            {/* Lacre padrão */}
            <div>
              <Label htmlFor="lacre_padrao_id">Lacre padrão</Label>
              <Select
                value={formData.lacre_padrao_id || ''}
                onValueChange={(value) => handleSelectChange('lacre_padrao_id', value)}
              >
                <SelectTrigger id="lacre_padrao_id" className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {itens.EMBALAGEM.filter((item) => item.descricao_interna?.toLowerCase().includes('lacre')).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.descricao_interna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precosSelecionados.lacre_padrao_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {precosSelecionados.lacre_padrao_id.custo_por_unidade_interna.toFixed(2)} / {precosSelecionados.lacre_padrao_id.unidade_interna}
                </p>
              )}
              {formData.lacre_padrao_id && !precosSelecionados.lacre_padrao_id && (
                <p className="text-xs text-amber-600 mt-1">sem preço — atualize via NF-e</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Salvando...' : 'Salvar Parâmetros'}
        </Button>
      </div>
    </div>
  );
}
