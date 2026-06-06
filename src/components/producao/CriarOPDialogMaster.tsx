// ============================================================
// MOTOR OP MASTER - DIÁLOGO DE CRIAÇÃO COMPLETO
// Sistema Industrial ANVISA com todas as 4 etapas
// Refatorado: lógica extraída para useOPWizardState
// ============================================================

import { useMemo } from "react";
import { 
  CalendarIcon, Package, FlaskConical, User, Hash, Calculator, 
  AlertTriangle, UserCheck, Beaker, Scale, Factory, ChevronRight,
  ChevronLeft, Check, FileText, Search, Plus, Building2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { RTSelectorOP } from "@/components/responsavel-tecnico/RTSelectorOP";
import { QuickClienteModal } from "@/components/entidades/QuickClienteModal";
import { EmbalagemItemSelector } from "@/components/producao/EmbalagemItemSelector";

import { useOPWizardState } from "./op-wizard/useOPWizardState";
import { type CriarOPDialogMasterProps, ACRESCIMO_INDUSTRIAL } from "./op-wizard/op-wizard-types";

// ============================================================
// COMPONENTE PRINCIPAL (UI ONLY)
// ============================================================

export function CriarOPDialogMaster({ open, onOpenChange, onSuccess }: CriarOPDialogMasterProps) {
  const state = useOPWizardState(open, onSuccess, onOpenChange);
  const {
    form, etapaAtual, formulas, pedidos, clientes, clienteSearch, setClienteSearch,
    selectedFormula, selectedPedido, selectedCliente, pedidoItens,
    isLoading, showClienteDropdown, setShowClienteDropdown,
    showQuickClienteModal, setShowQuickClienteModal,
    tipoOP, tipoProduto, quantidadeFrascos, unidadesPorFrasco,
    totalUnidades, totalComAcrescimo,
    pesoTotalMisturaKg, numeroBateladas, pesoPorBatelada, bateladaStatus, bateladaAlerta,
    volumeTotalPoL, volumePorBatelada, fatorEnchimentoReal, nomeMisturador,
    VOLUME_UTIL_MAX_L, VOLUME_UTIL_MIN_L,
    handleClienteSelect, handleQuickClienteCreated, handleFormulaChange, handlePedidoChange,
    podeAvancar, avancar, voltar, onSubmit, progressoEtapas,
  } = state;

  // ============================================================
  // ETAPA 1: TIPO DE OP
  // ============================================================
  const renderEtapa1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Factory className="h-12 w-12 mx-auto text-primary mb-2" />
        <h3 className="text-lg font-semibold">Tipo de Ordem de Produção</h3>
        <p className="text-sm text-muted-foreground">Escolha se deseja criar uma OP manual ou baseada em fórmula aprovada</p>
      </div>
      <FormField control={form.control} name="tipo_op" render={({ field }) => (
        <FormItem className="space-y-4">
          <FormControl>
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <RadioGroupItem value="MANUAL" id="manual" className="peer sr-only" />
                <Label htmlFor="manual" className={cn("flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground", field.value === "MANUAL" ? "border-primary bg-primary/5" : "border-muted")}>
                  <FileText className="h-8 w-8 mb-2" /><span className="font-semibold">OP Manual</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">Definir ativos e quantidades manualmente</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="BASEADA_FORMULA" id="formula" className="peer sr-only" />
                <Label htmlFor="formula" className={cn("flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground", field.value === "BASEADA_FORMULA" ? "border-primary bg-primary/5" : "border-muted")}>
                  <FlaskConical className="h-8 w-8 mb-2" /><span className="font-semibold">Baseada em Fórmula</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">Usar fórmula previamente aprovada</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="BASEADA_PEDIDO" id="pedido" className="peer sr-only" />
                <Label htmlFor="pedido" className={cn("flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground", field.value === "BASEADA_PEDIDO" ? "border-primary bg-primary/5" : "border-muted")}>
                  <Package className="h-8 w-8 mb-2" /><span className="font-semibold">Baseada em Pedido</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">Criar OP vinculada a pedido de venda</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="WHITE_LABEL" id="white_label" className="peer sr-only" />
                <Label htmlFor="white_label" className={cn("flex flex-col items-center justify-between rounded-lg border-2 p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground", field.value === "WHITE_LABEL" ? "border-primary bg-primary/5" : "border-muted")}>
                  <Package className="h-8 w-8 mb-2" /><span className="font-semibold">White Label</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">Produção sem cliente — estoque genérico para venda futura</span>
                </Label>
              </div>
            </RadioGroup>
          </FormControl>
        </FormItem>
      )} />

      {tipoOP === "BASEADA_FORMULA" && (
        <FormField control={form.control} name="formula_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Selecionar Fórmula Aprovada *</FormLabel>
            <Select value={field.value} onValueChange={handleFormulaChange}>
              <FormControl><SelectTrigger><SelectValue placeholder="Selecione uma fórmula" /></SelectTrigger></FormControl>
              <SelectContent>
                {formulas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.codigo_formula} - {f.nome_formula}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
            {formulas.length === 0 && (
              <Alert className="mt-2"><AlertTriangle className="h-4 w-4" /><AlertDescription>Nenhuma fórmula aprovada disponível.</AlertDescription></Alert>
            )}
            {selectedFormula && (
              <div className="mt-2 p-3 bg-muted rounded-lg space-y-1">
                <p className="text-sm font-medium">{selectedFormula.nome_formula}</p>
                <div className="flex gap-2"><Badge variant="outline">{selectedFormula.tipo_capsula || "00"}</Badge><Badge variant="secondary">{selectedFormula.excipiente_padrao || "AMIDO"}</Badge></div>
              </div>
            )}
          </FormItem>
        )} />
      )}

      {tipoOP === "BASEADA_PEDIDO" && (
        <FormField control={form.control} name="pedido_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Selecionar Pedido Confirmado *</FormLabel>
            <Select value={field.value} onValueChange={handlePedidoChange}>
              <FormControl><SelectTrigger><SelectValue placeholder="Selecione um pedido" /></SelectTrigger></FormControl>
              <SelectContent>
                {pedidos.map((p) => (<SelectItem key={p.id} value={p.id}>{p.codigo} - {p.cliente_nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
            {pedidos.length === 0 && (<Alert className="mt-2"><AlertTriangle className="h-4 w-4" /><AlertDescription>Nenhum pedido confirmado disponível.</AlertDescription></Alert>)}
            {selectedPedido && (<div className="mt-2 p-3 bg-muted rounded-lg"><p className="text-sm font-medium">{selectedPedido.cliente_nome}</p><p className="text-xs text-muted-foreground">{selectedPedido.cliente_documento}</p></div>)}
          </FormItem>
        )} />
      )}
    </div>
  );

  // ============================================================
  // ETAPA 2: DADOS PRODUTIVOS
  // ============================================================
  const renderEtapa2 = () => (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Dados Produtivos</h3>
        <Badge variant="destructive" className="ml-auto">Obrigatório</Badge>
      </div>

      {/* Cliente Section */}
      <Card className="border-secondary/30">
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Cliente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <FormLabel>Buscar Cliente *</FormLabel>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Digite nome, razão social ou CNPJ..." value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                onFocus={() => clientes.length > 0 && setShowClienteDropdown(true)} className="pl-9" />
            </div>
            {showClienteDropdown && clientes.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {clientes.map((cliente) => (
                  <div key={cliente.id} className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0" onClick={() => handleClienteSelect(cliente)}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{cliente.nome_fantasia || cliente.razao_social}</span>
                      {cliente.source === "local" && <Badge variant="outline" className="text-xs">Local</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{cliente.documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</div>
                  </div>
                ))}
              </div>
            )}
            {clienteSearch.length >= 2 && clientes.length === 0 && (
              <div className="mt-2"><Alert><AlertTriangle className="h-4 w-4" /><AlertDescription className="flex items-center justify-between"><span>Cliente não encontrado.</span><Button type="button" variant="outline" size="sm" onClick={() => setShowQuickClienteModal(true)}><Plus className="h-4 w-4 mr-1" />Cadastrar</Button></AlertDescription></Alert></div>
            )}
          </div>
          {selectedCliente && (
            <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/30">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">{selectedCliente.nome_fantasia || selectedCliente.razao_social}</p><p className="text-xs text-muted-foreground">CNPJ: {selectedCliente.documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p></div>
                <Badge variant="secondary">Vinculado</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product fields */}
      <FormField control={form.control} name="produto_nome" render={({ field }) => (
        <FormItem><FormLabel>Nome do Produto Final *</FormLabel><FormControl><Input placeholder="Ex: Vitamina D3 5000UI + K2 100mcg" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="tipo_produto" render={({ field }) => (
        <FormItem><FormLabel>Tipo de Produto *</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent><SelectItem value="CAPSULA">Cápsula (padrão)</SelectItem><SelectItem value="LIQUIDO">Líquido</SelectItem><SelectItem value="PO">Pó</SelectItem></SelectContent>
          </Select></FormItem>
      )} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={form.control} name="quantidade_frascos" render={({ field }) => (
          <FormItem><FormLabel>{tipoProduto === "PO" ? "Quantidade de Potes *" : "Quantidade de Frascos *"}</FormLabel><FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="unidades_por_frasco" render={({ field }) => (
          <FormItem><FormLabel>{tipoProduto === "CAPSULA" ? "Cápsulas/Frasco *" : tipoProduto === "LIQUIDO" ? "mL/Frasco *" : "g/Pote *"}</FormLabel><FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="space-y-2"><FormLabel>Total Produzido</FormLabel><div className="h-10 flex items-center px-3 bg-muted rounded-md"><span className="font-mono font-bold">{tipoProduto === "LIQUIDO" ? `${(totalUnidades / 1000).toFixed(2)} L` : tipoProduto === "PO" ? `${(totalUnidades / 1000).toFixed(2)} kg` : totalUnidades.toLocaleString()}</span></div></div>
      </div>

      <Card className="bg-primary/5 border-primary/20"><CardContent className="p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /><span>Acréscimo Industrial (+{ACRESCIMO_INDUSTRIAL}%):</span></div>
          <span className="font-mono font-bold text-primary">{tipoProduto === "LIQUIDO" ? `${(totalComAcrescimo / 1000).toFixed(2)} L` : tipoProduto === "PO" ? `${(totalComAcrescimo / 1000).toFixed(2)} kg` : `${totalComAcrescimo.toLocaleString()} cápsulas`}</span>
        </div>
      </CardContent></Card>

      {/* Packaging */}
      <Separator />
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Especificações de Embalagem</CardTitle><CardDescription>Selecione os itens de embalagem cadastrados no sistema</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {tipoProduto === "CAPSULA" && (
              <EmbalagemItemSelector label="Cápsula Vazia" tiposFiltro={["CAPSULA_VAZIA"]} value={form.watch("capsula_item_id")} selectedItemName={form.watch("capsula_item_nome")}
                onSelect={(item) => { form.setValue("capsula_item_id", item?.id || ""); form.setValue("capsula_item_nome", item?.descricao_interna || ""); form.setValue("capsula_item_source", item?.source); }} placeholder="Buscar cápsula..." />
            )}
            <EmbalagemItemSelector label="Pote/Frasco" tiposFiltro={["POTE", "EMBALAGEM"]} value={form.watch("pote_item_id")} selectedItemName={form.watch("pote_item_nome")}
              onSelect={(item) => { form.setValue("pote_item_id", item?.id || ""); form.setValue("pote_item_nome", item?.descricao_interna || ""); form.setValue("pote_item_source", item?.source); }} placeholder="Buscar pote ou frasco..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EmbalagemItemSelector label="Tampa" tiposFiltro={["TAMPA", "EMBALAGEM"]} value={form.watch("tampa_item_id")} selectedItemName={form.watch("tampa_item_nome")}
              onSelect={(item) => { form.setValue("tampa_item_id", item?.id || ""); form.setValue("tampa_item_nome", item?.descricao_interna || ""); form.setValue("tampa_item_source", item?.source); }} placeholder="Buscar tampa..." />
            <EmbalagemItemSelector label="Rótulo" tiposFiltro={["ROTULO", "EMBALAGEM"]} value={form.watch("descricao_rotulo")} selectedItemName={form.watch("descricao_rotulo")}
              onSelect={(item) => { form.setValue("descricao_rotulo", item?.descricao_interna || ""); }} placeholder="Buscar rótulo..." />
          </div>
          {tipoProduto !== "LIQUIDO" && (
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <FormField control={form.control} name="incluir_silica" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Incluir Sachê de Sílica Gel</FormLabel></FormItem>
              )} />
              {form.watch("incluir_silica") && (
                <EmbalagemItemSelector label="Sílica Gel" tiposFiltro={["SILICA", "EMBALAGEM"]} value={form.watch("silica_item_id")} selectedItemName={form.watch("silica_item_nome")}
                  onSelect={(item) => { form.setValue("silica_item_id", item?.id || ""); form.setValue("silica_item_nome", item?.descricao_interna || ""); form.setValue("silica_item_source", item?.source); }} placeholder="Buscar sílica gel..." />
              )}
            </div>
          )}
          <FormField control={form.control} name="descricao_rotulo" render={({ field }) => (
            <FormItem><FormLabel>Observações do Rótulo</FormLabel><FormControl><Textarea placeholder="Informações adicionais sobre o rótulo..." className="resize-none" rows={2} {...field} /></FormControl></FormItem>
          )} />
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================
  // ETAPA 3: LOTE E RASTREABILIDADE
  // ============================================================
  const renderEtapa3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4"><Hash className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Lote e Rastreabilidade</h3></div>
      <div className="grid grid-cols-3 gap-4">
        <FormField control={form.control} name="data_fabricacao" render={({ field }) => (
          <FormItem className="flex flex-col"><FormLabel>Data de Fabricação *</FormLabel>
            <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
              {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ptBR} /></PopoverContent></Popover><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="lote_produto_acabado" render={({ field }) => (
          <FormItem><FormLabel>Lote do Produto Acabado *</FormLabel><FormControl><Input placeholder="Ex: 260206-001" {...field} /></FormControl><FormDescription className="text-xs">Sugestão automática ao definir data</FormDescription><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="data_validade" render={({ field }) => (
          <FormItem className="flex flex-col"><FormLabel>Data de Validade *</FormLabel>
            <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
              {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ptBR} /></PopoverContent></Popover><FormMessage /></FormItem>
        )} />
      </div>
      {form.watch("lote_produto_acabado") && (
        <Card className="bg-primary/5 border-primary/20"><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /><span className="font-semibold text-sm">Resumo do Lote</span></div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Lote</p><p className="font-mono font-bold">{form.watch("lote_produto_acabado")}</p></div>
            <div><p className="text-muted-foreground">Fabricação</p><p className="font-medium">{form.watch("data_fabricacao") ? format(form.watch("data_fabricacao"), "dd/MM/yyyy") : "-"}</p></div>
            <div><p className="text-muted-foreground">Validade</p><p className="font-medium">{form.watch("data_validade") ? format(form.watch("data_validade"), "dd/MM/yyyy") : "-"}</p></div>
          </div>
        </CardContent></Card>
      )}
    </div>
  );

  // ============================================================
  // ETAPA 4: CONFIGURAÇÃO TÉCNICA + RT
  // ============================================================
  const renderEtapa4 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4"><UserCheck className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Configuração Técnica</h3></div>
      <div className="grid grid-cols-2 gap-4">
        {tipoProduto === "PO" ? (
          <FormField control={form.control} name="tipo_capsula" render={({ field }) => (
            <FormItem><FormLabel>Tamanho do Pote (g)</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="100">100 g</SelectItem><SelectItem value="200">200 g</SelectItem>
                  <SelectItem value="300">300 g</SelectItem><SelectItem value="500">500 g</SelectItem>
                  <SelectItem value="1000">1.000 g (1 kg)</SelectItem><SelectItem value="2500">2.500 g (2,5 kg)</SelectItem>
                  <SelectItem value="5000">5.000 g (5 kg)</SelectItem>
                </SelectContent></Select></FormItem>
          )} />
        ) : tipoProduto === "LIQUIDO" ? (
          <div /> /* Líquido não tem seleção de cápsula/pote */
        ) : (
          <FormField control={form.control} name="tipo_capsula" render={({ field }) => (
            <FormItem><FormLabel>Tamanho da Cápsula</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="000">000 (1.37 mL)</SelectItem><SelectItem value="00">00 (0.91 mL)</SelectItem>
                  <SelectItem value="0">0 (0.68 mL)</SelectItem><SelectItem value="1">1 (0.50 mL)</SelectItem>
                  <SelectItem value="2">2 (0.37 mL)</SelectItem><SelectItem value="3">3 (0.30 mL)</SelectItem>
                </SelectContent></Select></FormItem>
          )} />
        )}
        <FormField control={form.control} name="excipiente_base" render={({ field }) => (
          <FormItem><FormLabel>Excipiente Base (Q.S.P.)</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="AMIDO">Amido de Milho</SelectItem><SelectItem value="CELULOSE">Celulose Microcristalina</SelectItem><SelectItem value="PRE_BLEND">Pré-blend Industrial</SelectItem>
              </SelectContent></Select></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="responsavel_producao_nome" render={({ field }) => (
        <FormItem><FormLabel>Responsável pela Produção *</FormLabel><FormControl><Input placeholder="Nome do operador responsável" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="responsavel_tecnico_id" render={({ field }) => (
        <FormItem><FormLabel>Responsável Técnico *</FormLabel><FormControl>
          <RTSelectorOP value={field.value || ""} onChange={field.onChange} tipoProduto={tipoProduto as 'CAPSULA' | 'LIQUIDO' | 'PO'} />
        </FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="observacoes" render={({ field }) => (
        <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Observações sobre a produção..." className="resize-none" rows={3} {...field} /></FormControl></FormItem>
      )} />

      {/* Summary */}
      <Card className="border-primary/20"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Beaker className="h-4 w-4" />Resumo da OP</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Produto:</span><span className="font-medium">{form.watch("produto_nome") || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="font-medium">{tipoProduto}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Frascos:</span><span className="font-mono">{quantidadeFrascos}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Un./Frasco:</span><span className="font-mono">{unidadesPorFrasco}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-mono font-bold">{totalUnidades.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Com acréscimo:</span><span className="font-mono font-bold text-primary">{totalComAcrescimo.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lote:</span><span className="font-mono">{form.watch("lote_produto_acabado") || "-"}</span></div>
            {selectedFormula && <div className="flex justify-between"><span className="text-muted-foreground">Fórmula:</span><span className="font-medium">{selectedFormula.codigo_formula}</span></div>}
          </div>
        </CardContent></Card>

      {tipoProduto === 'CAPSULA' && totalUnidades > 0 && (
        <Card className={cn(
          bateladaStatus === 'bloqueado' ? 'border-destructive bg-destructive/5' :
          bateladaStatus === 'aviso_alto' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
          bateladaStatus === 'aviso_baixo' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' :
          'border-green-500 bg-green-50 dark:bg-green-950/20'
        )}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Scale className="h-4 w-4" />
              Planejamento do Misturador em V 100L
            </div>
            <div className="grid grid-cols-5 gap-3 text-sm">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Peso total pó</div>
                <div className="font-mono font-bold text-base">{pesoTotalMisturaKg.toFixed(2)} kg</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Volume total pó</div>
                <div className="font-mono font-bold text-base text-blue-600">{volumeTotalPoL.toFixed(1)} L</div>
                <div className="text-[10px] text-muted-foreground">÷ {(selectedFormula?.densidade_aparente_kg_l ?? 0.65)} kg/L</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Nº bateladas</div>
                <div className="font-mono font-bold text-base">{numeroBateladas}×</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Vol/batelada</div>
                <div className="font-mono font-bold text-base text-blue-600">{volumePorBatelada.toFixed(1)} L</div>
                <div className="text-[10px] text-muted-foreground">de 65L úteis</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Enchimento</div>
                <div className={cn(
                  "font-mono font-bold text-base",
                  fatorEnchimentoReal > 0.65 ? "text-red-600" :
                  fatorEnchimentoReal > 0.58 ? "text-yellow-600" :
                  fatorEnchimentoReal < 0.15 ? "text-blue-500" : "text-green-600"
                )}>
                  {(fatorEnchimentoReal * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-muted-foreground">ideal: 15–65%</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-1">
              Misturador em V 100L · máx. 65L úteis (65%) · mín. 15L (15%) · densidade: {(selectedFormula?.densidade_aparente_kg_l ?? 0.65).toFixed(2)} kg/L
            </div>
            {bateladaStatus === 'bloqueado' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{bateladaAlerta}</AlertDescription>
              </Alert>
            )}
            {bateladaStatus === 'aviso_alto' && (
              <Alert className="border-yellow-500 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{bateladaAlerta}</AlertDescription>
              </Alert>
            )}
            {bateladaStatus === 'aviso_baixo' && (
              <Alert className="border-blue-400 text-blue-800 dark:text-blue-200">
                <AlertDescription>{bateladaAlerta}</AlertDescription>
              </Alert>
            )}
            {bateladaStatus === 'ok' && (
              <p className="text-xs text-green-700 dark:text-green-400 text-center">✓ Carga dentro do range ideal de volume (15–65%)</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const ETAPAS = [
    { num: 1, label: "Tipo", icon: Factory },
    { num: 2, label: "Produção", icon: Package },
    { num: 3, label: "Lote", icon: Hash },
    { num: 4, label: "Técnico", icon: UserCheck },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Nova Ordem de Produção</DialogTitle>
            <DialogDescription>Preencha todas as etapas para criar a OP</DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              {ETAPAS.map((e, i) => (
                <div key={e.num} className="flex items-center">
                  <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    etapaAtual === e.num ? "bg-primary text-primary-foreground" : etapaAtual > e.num ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                    {etapaAtual > e.num ? <Check className="h-3 w-3" /> : <e.icon className="h-3 w-3" />}
                    <span>{e.label}</span>
                  </div>
                  {i < ETAPAS.length - 1 && <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <Progress value={progressoEtapas} className="h-1" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {etapaAtual === 1 && renderEtapa1()}
              {etapaAtual === 2 && renderEtapa2()}
              {etapaAtual === 3 && renderEtapa3()}
              {etapaAtual === 4 && renderEtapa4()}

              <DialogFooter className="flex justify-between">
                <div>{etapaAtual > 1 && (<Button type="button" variant="outline" onClick={voltar}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>)}</div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  {etapaAtual < 4 ? (
                    <Button type="button" onClick={avancar} disabled={!podeAvancar()}>Próxima<ChevronRight className="h-4 w-4 ml-1" /></Button>
                  ) : (
                    <Button type="submit" disabled={isLoading || !podeAvancar()}>{isLoading ? "Criando..." : "Criar Ordem de Produção"}</Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <QuickClienteModal open={showQuickClienteModal} onOpenChange={setShowQuickClienteModal} onClienteCreated={handleQuickClienteCreated} />
    </>
  );
}
