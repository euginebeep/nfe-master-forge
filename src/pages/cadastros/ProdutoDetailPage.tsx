import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Package, ArrowLeft, Save, Plus, Trash2, Star, Upload, Check, X, FileText, ExternalLink, Search } from "lucide-react";
import { EstoqueResumoCard } from "@/components/estoque/EstoqueResumoCard";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { 
  useItemAliases,
  useLoteDocumentos,
  canReleaseLote,
  LocalItem,
  LocalItemFornecedor,
  LocalItemAlias,
  LocalEstoqueLote,
  LocalLoteDocumento,
} from "@/hooks/use-local-itens";
import { useSupabaseItemFornecedores, useSupabaseEstoqueLotes } from "@/hooks/use-supabase-item-details";
import { useHybridEntidades } from "@/hooks/use-hybrid-data";
import { useHybridItem, useUpdateHybridItem, type HybridItem } from "@/hooks/use-hybrid-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { NFeVisualizacaoDialog } from "@/components/nfe/NFeVisualizacaoDialog";
import { COAParserButton } from "@/components/lotes/COAParserButton";

const TIPOS_ITEM = [
  { value: "MP", label: "Materia Prima" },
  { value: "EMBALAGEM", label: "Embalagem" },
  { value: "ROTULO", label: "Rotulo" },
  { value: "TAMPA", label: "Tampa" },
  { value: "POTE", label: "Pote" },
  { value: "SILICA", label: "Silica" },
  { value: "CAPSULA_VAZIA", label: "Capsula Vazia" },
  { value: "PA", label: "Produto Acabado" },
  { value: "OUTRO", label: "Outro" },
];

const CRITICIDADES = [
  { value: "NORMAL", label: "Normal" },
  { value: "ATENCAO", label: "Atencao" },
  { value: "CRITICO", label: "Critico" },
  { value: "ULTRA", label: "Ultra Critico" },
];

const ARMAZENAMENTOS = [
  { value: "AMBIENTE", label: "Ambiente" },
  { value: "REFRIGERADO", label: "Refrigerado" },
  { value: "PROTEGIDO_LUZ", label: "Protegido da Luz" },
  { value: "OUTRO", label: "Outro" },
];

const TIPOS_ALIAS = [
  { value: "ALIAS_FORNECEDOR", label: "Alias Fornecedor" },
  { value: "ALIAS_INTERNO", label: "Alias Interno" },
  { value: "ALIAS_MARKETPLACE", label: "Alias Marketplace" },
];

const STATUS_LOTE_VARIANTS: Record<string, "success" | "warning" | "error" | "muted"> = {
  QUARENTENA: "warning",
  DISPONIVEL: "success",
  BLOQUEADO: "error",
  VENCIDO: "muted",
};

export default function ProdutoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading, refetch } = useHybridItem(id);
  const updateMutation = useUpdateHybridItem();
  const { fornecedores, create: createFornecedor, remove: removeFornecedor } = useSupabaseItemFornecedores(id);
  const { aliases, create: createAlias, remove: removeAlias } = useItemAliases(id);
  const { lotes, update: updateLote, remove: removeLote } = useSupabaseEstoqueLotes(id);
  const { data: entidadesFornecedores = [] } = useHybridEntidades({ papel: "FORNECEDOR" });

  const [formData, setFormData] = useState<Partial<HybridItem>>({});
  const [showFornecedorForm, setShowFornecedorForm] = useState(false);
  const [showAliasForm, setShowAliasForm] = useState(false);
  const [showLoteForm, setShowLoteForm] = useState(false);
  const [selectedLote, setSelectedLote] = useState<any>(null);
  const [showDocumentos, setShowDocumentos] = useState(false);
  const [showNFeDialog, setShowNFeDialog] = useState(false);
  const [selectedChaveNfe, setSelectedChaveNfe] = useState<string>("");

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleSave = () => {
    if (!id) return;
    // Try hybrid update (Supabase first, then localStorage)
    updateMutation.mutate({ id, data: formData });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  if (!item) {
    return <div className="flex items-center justify-center h-64">Item nao encontrado</div>;
  }

  return (
    <div>
      <PageHeader
        title={item.descricao_interna}
        description={`SKU: ${item.sku_interno}`}
        icon={Package}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="geral" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal/Impostos</TabsTrigger>
          <TabsTrigger value="processo">Processo</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="aliases">Aliases</TabsTrigger>
          <TabsTrigger value="lotes">Lotes/Estoque</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        {/* Tab Geral */}
        <TabsContent value="geral">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Dados Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>SKU Interno</Label>
                    <Input
                      value={formData.sku_interno || ""}
                      onChange={(e) => setFormData({ ...formData, sku_interno: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Descricao Interna</Label>
                    <Input
                      value={formData.descricao_interna || ""}
                      onChange={(e) => setFormData({ ...formData, descricao_interna: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Descricao Comercial</Label>
                    <Input
                      value={formData.descricao_comercial || ""}
                      onChange={(e) => setFormData({ ...formData, descricao_comercial: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria Operacional</Label>
                    <Input
                      value={formData.categoria_operacional || ""}
                      onChange={(e) => setFormData({ ...formData, categoria_operacional: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo do Item</Label>
                    <Select 
                      value={formData.tipo_item} 
                      onValueChange={(v) => setFormData({ ...formData, tipo_item: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_ITEM.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade Interna</Label>
                    <Select 
                      value={formData.unidade_interna} 
                      onValueChange={(v) => setFormData({ ...formData, unidade_interna: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">Gramas (g)</SelectItem>
                        <SelectItem value="mg">Miligramas (mg)</SelectItem>
                        <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                        <SelectItem value="un">Unidades (un)</SelectItem>
                        <SelectItem value="ml">Mililitros (ml)</SelectItem>
                        <SelectItem value="l">Litros (l)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: !!checked })}
                  />
                  <label htmlFor="ativo" className="text-sm font-medium">Ativo</label>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Comercial - Preços e Custos (como no XML) */}
        <TabsContent value="comercial">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dados Comerciais (como aparecem no XML da NF-e)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Unidades e Conversão */}
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Unidades e Conversão</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Unidade Fornecedor (uCom)</Label>
                      <Input
                        value={(formData as any).unidade_fornecedor || ""}
                        onChange={(e) => setFormData({ ...formData, unidade_fornecedor: e.target.value } as any)}
                        placeholder="kg, un, milheiro..."
                      />
                      <p className="text-xs text-muted-foreground">Conforme nota fiscal</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade Interna</Label>
                      <Select 
                        value={formData.unidade_interna} 
                        onValueChange={(v) => setFormData({ ...formData, unidade_interna: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">Gramas (g)</SelectItem>
                          <SelectItem value="mg">Miligramas (mg)</SelectItem>
                          <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                          <SelectItem value="un">Unidades (un)</SelectItem>
                          <SelectItem value="ml">Mililitros (ml)</SelectItem>
                          <SelectItem value="l">Litros (l)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Controle interno</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Fator de Conversão</Label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.fator_conversao ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, fator_conversao: val === '' ? undefined : parseFloat(val) });
                        }}
                        placeholder="ex: 0.5, 1000"
                      />
                      <p className="text-xs text-muted-foreground">
                        1 {(formData as any).unidade_fornecedor || 'kg'} = {formData.fator_conversao || 1} {formData.unidade_interna || 'g'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preços de Referência */}
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Preços de Referência</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Preço Unitário (vUnCom)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.0001"
                          className="pl-10"
                          value={(formData as any).preco_unitario_fornecedor || ""}
                          onChange={(e) => setFormData({ ...formData, preco_unitario_fornecedor: parseFloat(e.target.value) || undefined } as any)}
                          placeholder="0.0000"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Por {(formData as any).unidade_fornecedor || 'kg'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Custo por Unidade Interna</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.000001"
                          className="pl-10"
                          value={(formData as any).custo_por_unidade_interna || ""}
                          onChange={(e) => setFormData({ ...formData, custo_por_unidade_interna: parseFloat(e.target.value) || undefined } as any)}
                          placeholder="0.000000"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Por {formData.unidade_interna || 'g'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>MOQ (Qtd. Mín. Pedido)</Label>
                      <Input
                        type="number"
                        value={(formData as any).moq || ""}
                        onChange={(e) => setFormData({ ...formData, moq: parseFloat(e.target.value) || undefined } as any)}
                        placeholder="25"
                      />
                      <p className="text-xs text-muted-foreground">Em {(formData as any).unidade_fornecedor || 'kg'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Lead Time (dias)</Label>
                      <Input
                        type="number"
                        value={(formData as any).lead_time_dias || ""}
                        onChange={(e) => setFormData({ ...formData, lead_time_dias: parseInt(e.target.value) || undefined } as any)}
                        placeholder="7"
                      />
                    </div>
                  </div>
                </div>

                {/* Observações Comerciais */}
                <div>
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Observações</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Observações Comerciais</Label>
                      <textarea 
                        className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                        value={(formData as any).observacoes_comerciais || ""}
                        onChange={(e) => setFormData({ ...formData, observacoes_comerciais: e.target.value } as any)}
                        placeholder="Condições especiais, negociações, histórico de preços..."
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Fiscal/Impostos - Dados completos do XML */}
        <TabsContent value="fiscal">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados Fiscais do Produto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Identificação Fiscal */}
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Identificação Fiscal</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>NCM</Label>
                      <Input
                        value={formData.ncm || ""}
                        onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                        placeholder="0000.00.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>EAN/GTIN</Label>
                      <Input
                        value={formData.ean || ""}
                        onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
                        placeholder="7891234567890"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CFOP Entrada Padrão</Label>
                      <Input
                        value={(formData as any).cfop_entrada_padrao || ""}
                        onChange={(e) => setFormData({ ...formData, cfop_entrada_padrao: e.target.value } as any)}
                        placeholder="1102, 2102..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CFOP Saída Padrão</Label>
                      <Input
                        value={(formData as any).cfop_saida_padrao || ""}
                        onChange={(e) => setFormData({ ...formData, cfop_saida_padrao: e.target.value } as any)}
                        placeholder="5102, 6102..."
                      />
                    </div>
                  </div>
                </div>

                {/* ICMS */}
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">ICMS</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>CST ICMS</Label>
                      <Input
                        value={(formData as any).cst_icms || ""}
                        onChange={(e) => setFormData({ ...formData, cst_icms: e.target.value } as any)}
                        placeholder="00, 10, 20..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alíquota ICMS (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData as any).aliquota_icms || ""}
                        onChange={(e) => setFormData({ ...formData, aliquota_icms: parseFloat(e.target.value) || undefined } as any)}
                        placeholder="18.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Origem</Label>
                      <Select 
                        value={(formData as any).origem_icms || "0"} 
                        onValueChange={(v) => setFormData({ ...formData, origem_icms: v } as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - Nacional</SelectItem>
                          <SelectItem value="1">1 - Estrangeira Importação</SelectItem>
                          <SelectItem value="2">2 - Estrangeira Adquirida</SelectItem>
                          <SelectItem value="3">3 - Nacional 40-70% importado</SelectItem>
                          <SelectItem value="4">4 - Nacional PPB</SelectItem>
                          <SelectItem value="5">5 - Nacional menos 40%</SelectItem>
                          <SelectItem value="6">6 - Estrangeira s/ similar</SelectItem>
                          <SelectItem value="7">7 - Estrangeira c/ similar</SelectItem>
                          <SelectItem value="8">8 - Nacional 70%+ importado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>MVA ST (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData as any).mva_st || ""}
                        onChange={(e) => setFormData({ ...formData, mva_st: parseFloat(e.target.value) || undefined } as any)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* IPI */}
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">IPI</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>CST IPI</Label>
                      <Input
                        value={(formData as any).cst_ipi || ""}
                        onChange={(e) => setFormData({ ...formData, cst_ipi: e.target.value } as any)}
                        placeholder="00, 01, 49, 50..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alíquota IPI (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData as any).aliquota_ipi || ""}
                        onChange={(e) => setFormData({ ...formData, aliquota_ipi: parseFloat(e.target.value) || undefined } as any)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código Enquadramento</Label>
                      <Input
                        value={(formData as any).codigo_enquadramento_ipi || ""}
                        onChange={(e) => setFormData({ ...formData, codigo_enquadramento_ipi: e.target.value } as any)}
                        placeholder="999"
                      />
                    </div>
                  </div>
                </div>

                {/* PIS/COFINS */}
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">PIS/COFINS</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>CST PIS</Label>
                      <Input
                        value={(formData as any).cst_pis || ""}
                        onChange={(e) => setFormData({ ...formData, cst_pis: e.target.value } as any)}
                        placeholder="01, 04, 06..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alíquota PIS (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData as any).aliquota_pis || ""}
                        onChange={(e) => setFormData({ ...formData, aliquota_pis: parseFloat(e.target.value) || undefined } as any)}
                        placeholder="1.65"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CST COFINS</Label>
                      <Input
                        value={(formData as any).cst_cofins || ""}
                        onChange={(e) => setFormData({ ...formData, cst_cofins: e.target.value } as any)}
                        placeholder="01, 04, 06..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alíquota COFINS (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(formData as any).aliquota_cofins || ""}
                        onChange={(e) => setFormData({ ...formData, aliquota_cofins: parseFloat(e.target.value) || undefined } as any)}
                        placeholder="7.60"
                      />
                    </div>
                  </div>
                </div>

                {/* Informações Adicionais Fiscais */}
                <div>
                  <h4 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Informações Adicionais</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CEST (se aplicável)</Label>
                      <Input
                        value={(formData as any).cest || ""}
                        onChange={(e) => setFormData({ ...formData, cest: e.target.value } as any)}
                        placeholder="00.000.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código ANP (se combustível)</Label>
                      <Input
                        value={(formData as any).codigo_anp || ""}
                        onChange={(e) => setFormData({ ...formData, codigo_anp: e.target.value } as any)}
                        placeholder=""
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label>Observações Fiscais</Label>
                    <textarea 
                      className="w-full min-h-[80px] p-3 rounded-md border bg-background"
                      value={(formData as any).observacoes_fiscais || ""}
                      onChange={(e) => setFormData({ ...formData, observacoes_fiscais: e.target.value } as any)}
                      placeholder="Informações adicionais para nota fiscal, benefícios fiscais, etc..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Processo */}
        <TabsContent value="processo">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Dados de Processo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Criticidade</Label>
                    <Select 
                      value={formData.criticidade} 
                      onValueChange={(v) => setFormData({ ...formData, criticidade: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CRITICIDADES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Armazenamento</Label>
                    <Select 
                      value={formData.armazenamento} 
                      onValueChange={(v) => setFormData({ ...formData, armazenamento: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ARMAZENAMENTOS.map((a) => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade Declaracao</Label>
                    <Input
                      value={formData.unidade_declaracao || ""}
                      onChange={(e) => setFormData({ ...formData, unidade_declaracao: e.target.value })}
                      placeholder="mg, mcg, UI..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade Pesagem</Label>
                    <Input
                      value={formData.unidade_pesagem || ""}
                      onChange={(e) => setFormData({ ...formData, unidade_pesagem: e.target.value })}
                      placeholder="mg, g..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fator Conversao</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formData.fator_conversao ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, fator_conversao: val === '' ? undefined : parseFloat(val) });
                      }}
                      placeholder="ex: 0.5, 1000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="controla_lote"
                      checked={formData.controla_lote}
                      onCheckedChange={(checked) => setFormData({ ...formData, controla_lote: !!checked })}
                    />
                    <label htmlFor="controla_lote" className="text-sm">Controla Lote</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="controla_validade"
                      checked={formData.controla_validade}
                      onCheckedChange={(checked) => setFormData({ ...formData, controla_validade: !!checked })}
                    />
                    <label htmlFor="controla_validade" className="text-sm">Controla Validade</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="higroscopico"
                      checked={formData.higroscopico}
                      onCheckedChange={(checked) => setFormData({ ...formData, higroscopico: !!checked })}
                    />
                    <label htmlFor="higroscopico" className="text-sm">Higroscopico</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="exige_premix"
                      checked={formData.exige_premix}
                      onCheckedChange={(checked) => setFormData({ ...formData, exige_premix: !!checked })}
                    />
                    <label htmlFor="exige_premix" className="text-sm">Exige Premix</label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Fornecedores */}
        <TabsContent value="fornecedores">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Fornecedores do Item</CardTitle>
                <Button size="sm" onClick={() => setShowFornecedorForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Vincular Fornecedor
                </Button>
              </CardHeader>
              <CardContent>
                {fornecedores.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum fornecedor vinculado</p>
                ) : (
                  <div className="space-y-3">
                    {fornecedores.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {f.fornecedor_preferencial && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                          <div>
                            <p className="font-medium">{String(f.fornecedor?.razao_social ?? "Fornecedor")}</p>
                            <p className="text-sm text-muted-foreground">
                              Codigo: {f.codigo_fornecedor || "-"} | 
                              Unidade: {f.unidade_compra_padrao} | 
                              Fator: {f.fator_para_unidade_interna}x
                            </p>
                            {f.descricao_fornecedor && (
                              <p className="text-sm text-muted-foreground">
                                Descricao: {f.descricao_fornecedor}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeFornecedor(f.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Aliases */}
        <TabsContent value="aliases">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Aliases do Item</CardTitle>
                <Button size="sm" onClick={() => setShowAliasForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Alias
                </Button>
              </CardHeader>
              <CardContent>
                {aliases.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum alias cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {aliases.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <StatusBadge variant="muted">{a.tipo}</StatusBadge>
                          <p className="mt-1">{a.texto}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeAlias(a.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Lotes */}
        <TabsContent value="lotes">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Resumo de Estoque Total */}
            {lotes.length > 0 && (
              <EstoqueResumoCard lotes={lotes} unidadeInternaItem={item.unidade_interna} />
            )}
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lotes em Estoque</CardTitle>
                <Button size="sm" onClick={() => setShowLoteForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lote
                </Button>
              </CardHeader>
              <CardContent>
                {lotes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum lote cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {lotes.map((l) => (
                      <div key={l.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{l.numero_lote}</span>
                            <StatusBadge variant={STATUS_LOTE_VARIANTS[l.status]}>
                              {l.status}
                            </StatusBadge>
                          </div>
                          <div className="flex gap-2">
                            <COAParserButton 
                              materiasPrimas={[{ id: item.id, descricao: item.descricao_interna }]}
                              onPotenciaEncontrada={(dados) => {
                                // Update lote with potency data
                                type TipoPotencia = "UI_POR_GRAMA" | "MG_POR_GRAMA" | "PERCENTUAL" | "NENHUMA";
                                const tipoMap: Record<string, TipoPotencia> = {
                                  "UI_POR_GRAMA": "UI_POR_GRAMA",
                                  "MG_POR_GRAMA": "MG_POR_GRAMA", 
                                  "PERCENTUAL": "PERCENTUAL",
                                };
                                const tipoPotencia = tipoMap[dados.tipo] || "NENHUMA";
                                updateLote(l.id, { 
                                  tipo_potencia: tipoPotencia,
                                  potencia_valor: dados.valor,
                                  potencia_unidade: dados.tipo === "UI_POR_GRAMA" ? "UI/g" : 
                                                   dados.tipo === "MG_POR_GRAMA" ? "mg/g" : "%"
                                });
                                toast.success(`Potência ${dados.valor} ${dados.tipo === "UI_POR_GRAMA" ? "UI/g" : dados.tipo === "MG_POR_GRAMA" ? "mg/g" : "%"} registrada no lote ${l.numero_lote}`);
                              }}
                            />
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedLote(l);
                                setShowDocumentos(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Documentos
                            </Button>
                            {l.status === "QUARENTENA" && canReleaseLote(l.id, id!) && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  updateLote(l.id, { status: "DISPONIVEL" });
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Liberar
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeLote(l.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Dados da Nota */}
                        {l.nota_entrada_item?.nota_entrada?.numero && (
                          <div className="mb-3 p-2 bg-muted/50 rounded text-sm flex items-center gap-2">
                            <button
                              onClick={() => {
                                const chave = l.nota_entrada_item?.nota_entrada?.chave_nfe;
                                if (chave) {
                                  setSelectedChaveNfe(chave);
                                  setShowNFeDialog(true);
                                }
                              }}
                              className="font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
                              disabled={!l.nota_entrada_item?.nota_entrada?.chave_nfe}
                            >
                              NF-e {l.nota_entrada_item.nota_entrada.numero}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                            {l.nota_entrada_item.nota_entrada.serie && <span className="text-muted-foreground">| Série {l.nota_entrada_item.nota_entrada.serie}</span>}
                            {l.nota_entrada_item.nota_entrada.dh_emissao && <span className="text-muted-foreground">| {new Date(l.nota_entrada_item.nota_entrada.dh_emissao).toLocaleDateString('pt-BR')}</span>}
                          </div>
                        )}
                        
                        {/* Quantidades e Conversão */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Fornecedor</p>
                            <p>{String(l.fornecedor?.razao_social ?? "-")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Qtd Original (Nota)</p>
                            <p className="font-medium">
                              {l.quantidade_original?.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {l.unidade_original}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Qtd Interna (Convertido)</p>
                            <p className="font-medium text-primary">
                              {l.quantidade_interna?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {item.unidade_interna}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Validade</p>
                            <p className={l.data_val && new Date(l.data_val) < new Date() ? "text-destructive font-medium" : ""}>
                              {l.data_val ? new Date(l.data_val).toLocaleDateString('pt-BR') : "-"}
                            </p>
                          </div>
                        </div>
                        
                        {/* Preços e Custos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t">
                          <div>
                            <p className="text-muted-foreground">Preço Unit. Original</p>
                            <p className="font-medium">
                              R$ {l.custo_unitario_original?.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) || "-"}/{l.unidade_original}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Custo Unit. Interno</p>
                            <p className="font-medium text-primary">
                              R$ {l.custo_unitario_interno?.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 }) || "-"}/{item.unidade_interna}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor Total (Nota)</p>
                            <p className="font-medium">
                              R$ {l.nota_entrada_item?.vprod?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor Estoque (R$)</p>
                            <p className="font-medium text-emerald-500">
                              R$ {((l.quantidade_interna || 0) * (l.custo_unitario_interno || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Fabricação</p>
                            <p>{l.data_fab ? new Date(l.data_fab).toLocaleDateString('pt-BR') : "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Tab Documentos */}
        <TabsContent value="documentos">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Documentos por Lote</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Selecione um lote na aba "Lotes" e clique em "Documentos" para gerenciar COA/laudos.
                </p>
                {lotes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum lote cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {lotes.map((l) => (
                      <Button 
                        key={l.id}
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedLote(l);
                          setShowDocumentos(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Lote {l.numero_lote} - Ver Documentos
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Fornecedor Form Dialog */}
      <FornecedorFormDialog
        open={showFornecedorForm}
        onOpenChange={setShowFornecedorForm}
        itemId={id!}
        fornecedores={entidadesFornecedores as any}
        onSave={(data: any) => {
          createFornecedor(data);
          setShowFornecedorForm(false);
        }}
      />

      {/* Alias Form Dialog */}
      <AliasFormDialog
        open={showAliasForm}
        onOpenChange={setShowAliasForm}
        itemId={id!}
        onSave={(data) => {
          createAlias(data as Omit<LocalItemAlias, 'id'>);
          setShowAliasForm(false);
        }}
      />

      {/* Lote Form Dialog - disabled, lotes are created via NF-e import */}

      {/* Documentos Dialog */}
      {selectedLote && (
        <LoteDocumentosDialog
          open={showDocumentos}
          onOpenChange={setShowDocumentos}
          lote={selectedLote}
          itemId={id!}
          onLoteUpdate={() => {
            refetch();
          }}
        />
      )}

      {/* NF-e Visualização Dialog */}
      <NFeVisualizacaoDialog
        open={showNFeDialog}
        onOpenChange={setShowNFeDialog}
        chaveNfe={selectedChaveNfe}
      />
    </div>
  );
}

// Fornecedor Form Dialog
function FornecedorFormDialog({ 
  open, 
  onOpenChange, 
  itemId,
  fornecedores,
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  itemId: string;
  fornecedores: { id: string; razao_social: string }[];
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [formData, setFormData] = useState({
    fornecedor_id: "",
    codigo_fornecedor: "",
    descricao_fornecedor: "",
    unidade_compra_padrao: "kg" as const,
    fator_para_unidade_interna: 1000,
    fornecedor_preferencial: false,
    preco_referencia: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular Fornecedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Select 
              value={formData.fornecedor_id} 
              onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Codigo Fornecedor (cProd)</Label>
              <Input
                value={formData.codigo_fornecedor}
                onChange={(e) => setFormData({ ...formData, codigo_fornecedor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade Compra</Label>
              <Select 
                value={formData.unidade_compra_padrao} 
                onValueChange={(v) => setFormData({ ...formData, unidade_compra_padrao: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                  <SelectItem value="g">Gramas (g)</SelectItem>
                  <SelectItem value="un">Unidades (un)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descricao do Fornecedor</Label>
            <Input
              value={formData.descricao_fornecedor}
              onChange={(e) => setFormData({ ...formData, descricao_fornecedor: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fator para Unidade Interna</Label>
              <Input
                type="number"
                value={formData.fator_para_unidade_interna}
                onChange={(e) => setFormData({ ...formData, fator_para_unidade_interna: parseFloat(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Ex: kg para g = 1000</p>
            </div>
            <div className="space-y-2">
              <Label>Preco Referencia</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.preco_referencia}
                onChange={(e) => setFormData({ ...formData, preco_referencia: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fornecedor_preferencial"
              checked={formData.fornecedor_preferencial}
              onCheckedChange={(checked) => setFormData({ ...formData, fornecedor_preferencial: !!checked })}
            />
            <label htmlFor="fornecedor_preferencial" className="text-sm">Fornecedor Preferencial</label>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave({ ...formData, item_id: itemId })}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Alias Form Dialog
function AliasFormDialog({ 
  open, 
  onOpenChange, 
  itemId,
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  itemId: string;
  onSave: (data: Partial<LocalItemAlias>) => void;
}) {
  const [formData, setFormData] = useState({
    tipo: "ALIAS_INTERNO" as const,
    texto: "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Alias</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select 
              value={formData.tipo} 
              onValueChange={(v) => setFormData({ ...formData, tipo: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ALIAS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Texto do Alias</Label>
            <Input
              value={formData.texto}
              onChange={(e) => setFormData({ ...formData, texto: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave({ ...formData, item_id: itemId })}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Lote Form Dialog
function LoteFormDialog({ 
  open, 
  onOpenChange, 
  itemId,
  item,
  fornecedores,
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  itemId: string;
  item: LocalItem;
  fornecedores: any[];
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    fornecedor_id: "",
    numero_lote: "",
    data_fab: "",
    data_val: "",
    quantidade_original: 0,
    unidade_original: "kg" as const,
    custo_unitario_original: 0,
    status: "QUARENTENA" as const,
    fator_para_unidade_interna: 1000,
  });

  // Auto-set status based on item type
  useEffect(() => {
    if (item.tipo_item === "MP" || item.criticidade === "CRITICO" || item.criticidade === "ULTRA") {
      setFormData(prev => ({ ...prev, status: "QUARENTENA" }));
    }
  }, [item]);

  // Update fator when fornecedor changes
  const handleFornecedorChange = (fornecedorId: string) => {
    const forn = fornecedores.find(f => f.fornecedor_id === fornecedorId);
    setFormData(prev => ({
      ...prev,
      fornecedor_id: fornecedorId,
      unidade_original: forn?.unidade_compra_padrao || "kg",
      fator_para_unidade_interna: forn?.fator_para_unidade_interna || 1000,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select 
              value={formData.fornecedor_id} 
              onValueChange={handleFornecedorChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.fornecedor_id} value={f.fornecedor_id}>
                    {f.fornecedor?.razao_social || "Fornecedor"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Numero do Lote *</Label>
            <Input
              value={formData.numero_lote}
              onChange={(e) => setFormData({ ...formData, numero_lote: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Fabricacao</Label>
              <Input
                type="date"
                value={formData.data_fab}
                onChange={(e) => setFormData({ ...formData, data_fab: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Validade</Label>
              <Input
                type="date"
                value={formData.data_val}
                onChange={(e) => setFormData({ ...formData, data_val: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                value={formData.quantidade_original}
                onChange={(e) => setFormData({ ...formData, quantidade_original: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select 
                value={formData.unidade_original} 
                onValueChange={(v) => setFormData({ ...formData, unidade_original: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="un">un</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fator Conv.</Label>
              <Input
                type="number"
                value={formData.fator_para_unidade_interna}
                onChange={(e) => setFormData({ ...formData, fator_para_unidade_interna: parseFloat(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Custo Unitario Original</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.custo_unitario_original}
              onChange={(e) => setFormData({ ...formData, custo_unitario_original: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p>Quantidade Interna: <strong>{(formData.quantidade_original * formData.fator_para_unidade_interna).toLocaleString()} {item.unidade_interna}</strong></p>
            <p>Custo Interno: <strong>R$ {(formData.custo_unitario_original / formData.fator_para_unidade_interna).toFixed(4)}/{item.unidade_interna}</strong></p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={() => onSave({ ...formData, item_id: itemId })}
              disabled={!formData.numero_lote}
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Lote Documentos Dialog
function LoteDocumentosDialog({ 
  open, 
  onOpenChange, 
  lote,
  itemId,
  onLoteUpdate
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  lote: LocalEstoqueLote;
  itemId: string;
  onLoteUpdate: () => void;
}) {
  const { documentos, create, validate, reject, remove, refresh } = useLoteDocumentos(lote.id);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      create({
        lote_id: lote.id,
        tipo_documento: "COA",
        arquivo_nome: file.name,
        arquivo_tipo: file.type,
        arquivo_size: file.size,
        arquivo_data: reader.result as string,
        status_validacao: "PENDENTE",
      });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleValidate = (docId: string) => {
    validate(docId);
    // Check if lote can now be released
    setTimeout(() => {
      if (canReleaseLote(lote.id, itemId)) {
        toast.info("Lote pode ser liberado! COA validado.");
      }
      onLoteUpdate();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Documentos do Lote {lote.numero_lote}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {uploading ? "Carregando..." : "Clique para fazer upload de COA/Laudo (PDF)"}
                </p>
              </div>
            </Label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.jpg,.png"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </div>

          {documentos.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum documento anexado</p>
          ) : (
            <div className="space-y-3">
              {documentos.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.arquivo_nome}</p>
                      <div className="flex items-center gap-2">
                        <StatusBadge variant="muted">{doc.tipo_documento}</StatusBadge>
                        <StatusBadge 
                          variant={
                            doc.status_validacao === "VALIDADO" ? "success" : 
                            doc.status_validacao === "REJEITADO" ? "error" : "warning"
                          }
                        >
                          {doc.status_validacao}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {doc.status_validacao === "PENDENTE" && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleValidate(doc.id)}
                          title="Validar"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => reject(doc.id)}
                          title="Rejeitar"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => remove(doc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
