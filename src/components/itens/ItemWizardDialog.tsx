import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Package, ArrowRight, ArrowLeft, Check, AlertTriangle, Calculator, Pill, Beaker,
  FileText, DollarSign, ClipboardList, Users, Tag, Plus, Trash2, Star,
} from "lucide-react";
import { CapsulePhotoUpload } from "./CapsulePhotoUpload";
import { formatarUnidade } from "@/lib/erp-validation";
import { calcularFatorConversaoAutomatico } from "@/lib/erp-validation";
import { useItemWizardState } from "./wizard/useItemWizardState";
import { TOOLTIPS } from "@/components/ajuda/TooltipAjuda";
import {
  TIPOS_ITEM, CRITICIDADES, ARMAZENAMENTOS, UNIDADES_FORNECEDOR, UNIDADES_INTERNAS,
  TIPOS_POTENCIA, TAMANHOS_CAPSULA, MATERIAIS_CAPSULA, MARCAS_CAPSULA_SUGERIDAS,
  CST_ICMS_OPTIONS, CST_PIS_COFINS_OPTIONS, CST_IPI_OPTIONS, TIPOS_ALIAS,
  WIZARD_STEPS, TOTAL_STEPS,
} from "./wizard/item-wizard-constants";
import type { UnidadeFornecedor, UnidadeInternaLocal } from "@/hooks/use-local-itens";

interface ItemWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ItemWizardDialog({ open, onOpenChange, onSuccess }: ItemWizardDialogProps) {
  const s = useItemWizardState(onSuccess);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Novo Produto / Insumo
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Etapa {s.currentStep} de {TOTAL_STEPS}</span>
            <span className="text-muted-foreground">{WIZARD_STEPS[s.currentStep - 1].title}</span>
          </div>
          <Progress value={s.progressPercent} className="h-2" />
          <div className="flex justify-between">
            {WIZARD_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = s.currentStep === step.id;
              const isCompleted = s.currentStep > step.id;
              return (
                <div key={step.id} className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary' : isCompleted ? 'text-primary/60' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-primary bg-primary/10' : isCompleted ? 'border-primary/60 bg-primary/5' : 'border-muted'}`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs hidden md:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div className="min-h-[400px]">
          {/* Step 1: Identificação */}
          {s.currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Identificação do Produto</h3>
              <div>
                <Label className="mb-2 block">Tipo de Item *</Label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {TIPOS_ITEM.map((tipo) => (
                    <Card key={tipo.value} className={`cursor-pointer transition-all hover:border-primary ${s.tipoItem === tipo.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`} onClick={() => s.setTipoItem(tipo.value)}>
                      <CardContent className="p-3 text-center">
                        <p className="font-medium text-sm">{tipo.label}</p>
                        <p className="text-xs text-muted-foreground">{tipo.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>SKU Interno</Label>
                  <Input value={s.skuInterno} onChange={(e) => s.setSkuInterno(e.target.value)} placeholder="AUTO-001 (gerado automaticamente se vazio)" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Descrição Interna *</Label>
                  <Input value={s.descricaoInterna} onChange={(e) => s.setDescricaoInterna(e.target.value)} placeholder="Nome técnico do produto" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Descrição Comercial</Label>
                  <Input value={s.descricaoComercial} onChange={(e) => s.setDescricaoComercial(e.target.value)} placeholder="Nome para documentos e vendas" />
                </div>
                <div className="space-y-2">
                  <Label>Categoria Operacional</Label>
                  <Input value={s.categoriaOperacional} onChange={(e) => s.setCategoriaOperacional(e.target.value)} placeholder="Ex: Vitaminas, Aminoácidos..." />
                </div>
              </div>
              {s.isCapsule && (
                <Card className="border-primary/30">
                  <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Pill className="h-4 w-4" /> Dados Específicos de Cápsula</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Tamanho *</Label>
                        <Select value={s.capsulaTamanho} onValueChange={s.setCapsulaTamanho}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{TAMANHOS_CAPSULA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Material *</Label>
                        <Select value={s.capsulaMaterial} onValueChange={s.setCapsulaMaterial}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{MATERIAIS_CAPSULA.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cor</Label>
                        <Input value={s.capsulaCor} onChange={(e) => s.setCapsulaCor(e.target.value)} placeholder="Ex: Transparente" />
                      </div>
                      <div className="space-y-2">
                        <Label>Marca</Label>
                        <Select value={s.capsulaMarca} onValueChange={s.setCapsulaMarca}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{MARCAS_CAPSULA_SUGERIDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                      </div>
                    </div>
                    <CapsulePhotoUpload currentPhotoUrl={s.fotoUrl} onPhotoChange={(url) => s.setFotoUrl(url)} />
                  </CardContent>
                </Card>
              )}
              {!s.validacaoTipoItem.valido && (
                <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription><ul className="list-disc list-inside">{s.validacaoTipoItem.erros.map((erro, i) => <li key={i}>{erro}</li>)}</ul></AlertDescription></Alert>
              )}
            </div>
          )}

          {/* Step 2: Unidades */}
          {s.currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Calculator className="h-5 w-5" /> Unidades e Conversão</h3>
              <Card>
                <CardHeader className="py-3"><CardTitle className="text-base">Regra Mestre de Unidades</CardTitle><CardDescription>Defina como converter a unidade do fornecedor para a unidade interna de controle</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Unidade Fornecedor</Label>
                      <Select value={s.unidadeFornecedor} onValueChange={(v) => s.setUnidadeFornecedor(v as UnidadeFornecedor)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNIDADES_FORNECEDOR.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent></Select>
                      <p className="text-xs text-muted-foreground">uCom da NF-e</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Fator de Conversão</Label>
                      <div className="flex gap-2">
                        <Input type="number" value={s.fatorConversao} onChange={(e) => { s.setFatorConversao(parseFloat(e.target.value) || 1); s.setFatorManual(true); }} placeholder="1000" />
                        <Button type="button" variant="outline" size="sm" onClick={() => { const auto = calcularFatorConversaoAutomatico(s.unidadeFornecedor, s.unidadeInterna); if (auto !== null) { s.setFatorConversao(auto); s.setFatorManual(false); } }}>Auto</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">1 {formatarUnidade(s.unidadeFornecedor)} = X {formatarUnidade(s.unidadeInterna)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade Interna</Label>
                      <Select value={s.unidadeInterna} onValueChange={(v) => s.setUnidadeInterna(v as UnidadeInternaLocal)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNIDADES_INTERNAS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent></Select>
                      <p className="text-xs text-muted-foreground">Unidade padronizada do sistema</p>
                    </div>
                  </div>
                  {!s.validacaoFator.valido && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{s.validacaoFator.erro}</AlertDescription></Alert>}
                  <div className="p-3 bg-background rounded-lg border">
                    <div className="flex items-center gap-2 text-sm font-medium mb-2"><Calculator className="h-4 w-4 text-primary" /> Preview da Conversão</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Estoque: </span><span className="font-mono">1 {formatarUnidade(s.unidadeFornecedor)} → {s.fatorConversao.toLocaleString('pt-BR')} {formatarUnidade(s.unidadeInterna)}</span></div>
                      <div><span className="text-muted-foreground">Custo: </span><span className="font-mono">R$ 100,00/{formatarUnidade(s.unidadeFornecedor)} → R$ {(100 / s.fatorConversao).toFixed(4)}/{formatarUnidade(s.unidadeInterna)}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {s.isAtivo && (
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Beaker className="h-4 w-4" /> Potência / Concentração (Referência)</CardTitle><CardDescription>A potência real será registrada no lote, conforme COA do fornecedor</CardDescription></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Potência</Label>
                        <Select value={s.tipoPotencia} onValueChange={s.setTipoPotencia}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_POTENCIA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                      {s.tipoPotencia !== 'NENHUMA' && (
                        <div className="space-y-2">
                          <Label>Valor de Referência</Label>
                          <Input type="number" step="0.0001" value={s.valorPotencia || ''} onChange={(e) => s.setValorPotencia(parseFloat(e.target.value) || undefined)} placeholder={s.tipoPotencia === 'UI_POR_GRAMA' ? '400000' : '0.5'} />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>% Elementar (minerais)</Label>
                        <Input type="number" step="0.01" value={s.percentualElementar || ''} onChange={(e) => s.setPercentualElementar(parseFloat(e.target.value) || undefined)} placeholder="Ex: 16 para Citrato de Mg" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Comercial */}
          {s.currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5" /> Dados Comerciais</h3>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Preço Unitário (R$/{formatarUnidade(s.unidadeFornecedor)})</Label><Input type="number" step="0.01" value={s.precoUnitarioFornecedor || ''} onChange={(e) => s.setPrecoUnitarioFornecedor(parseFloat(e.target.value) || undefined)} placeholder="0,00" /><p className="text-xs text-muted-foreground">vUnCom da NF-e</p></div>
                    <div className="space-y-2"><Label>MOQ (Qtd. Mínima)</Label><Input type="number" step="0.01" value={s.moq || ''} onChange={(e) => s.setMoq(parseFloat(e.target.value) || undefined)} placeholder="Ex: 25 kg" /></div>
                    <div className="space-y-2"><Label>Lead Time (dias)</Label><Input type="number" value={s.leadTimeDias || ''} onChange={(e) => s.setLeadTimeDias(parseInt(e.target.value) || undefined)} placeholder="Ex: 15" /></div>
                  </div>
                  {s.custoInternoCalculado !== undefined && (
                    <div className="p-3 bg-muted rounded-lg"><div className="text-sm"><span className="text-muted-foreground">Custo por Unidade Interna: </span><span className="font-mono font-bold text-primary">R$ {s.custoInternoCalculado.toFixed(6)} / {formatarUnidade(s.unidadeInterna)}</span></div></div>
                  )}
                  <div className="space-y-2"><Label>Observações Comerciais</Label><Textarea value={s.observacoesComerciais} onChange={(e) => s.setObservacoesComerciais(e.target.value)} placeholder="Condições de pagamento, negociações especiais..." rows={3} /></div>
                  {s.validacaoComercial.avisos.length > 0 && <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription><ul className="list-disc list-inside">{s.validacaoComercial.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></AlertDescription></Alert>}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Fiscal */}
          {s.currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Dados Fiscais</h3>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label className="flex items-center gap-1.5">NCM {TOOLTIPS.ncm}</Label><Input value={s.ncm} onChange={(e) => s.setNcm(e.target.value)} placeholder="0000.00.00" /></div>
                    <div className="space-y-2"><Label>EAN/GTIN</Label><Input value={s.ean} onChange={(e) => s.setEan(e.target.value)} placeholder="7891234567890" /></div>
                    <div className="space-y-2"><Label>CEST</Label><Input value={s.cest} onChange={(e) => s.setCest(e.target.value)} placeholder="00.000.00" /></div>
                  </div>

                  {/* Notificação ANVISA — RDC 843/2024 */}
                  <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                    <div className="text-xs font-semibold text-amber-800 uppercase mb-2 flex items-center gap-1">
                      <span>⚠</span> Notificação ANVISA — Obrigatório a partir de setembro/2026
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>N° Notificação ANVISA</Label>
                        <Input
                          placeholder="Ex: 6.2024.0001234"
                          value={s.numeroNotificacaoAnvisa}
                          onChange={(e) => s.setNumeroNotificacaoAnvisa(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Data da Notificação</Label>
                        <Input
                          type="date"
                          value={s.dataNotificacaoAnvisa}
                          onChange={(e) => s.setDataNotificacaoAnvisa(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Status Regulatório</Label>
                        <Select
                          value={s.statusRegulatorio}
                          onValueChange={s.setStatusRegulatorio}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NOTIFICADO">Notificado</SelectItem>
                            <SelectItem value="DISPENSADO">Dispensado (verificar)</SelectItem>
                            <SelectItem value="REGISTRADO">Registrado (RDC anterior)</SelectItem>
                            <SelectItem value="PENDENTE">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>CFOP Entrada Padrão</Label><Input value={s.cfopEntradaPadrao} onChange={(e) => s.setCfopEntradaPadrao(e.target.value)} placeholder="Ex: 1102" /></div>
                    <div className="space-y-2"><Label>CFOP Saída Padrão</Label><Input value={s.cfopSaidaPadrao} onChange={(e) => s.setCfopSaidaPadrao(e.target.value)} placeholder="Ex: 5102" /></div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">ICMS</Label>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2"><Label className="text-xs">CST</Label><Select value={s.cstIcms} onValueChange={s.setCstIcms}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{CST_ICMS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label className="text-xs">Origem</Label><Select value={s.origemIcms} onValueChange={s.setOrigemIcms}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">0 - Nacional</SelectItem><SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem><SelectItem value="2">2 - Estrangeira (mercado interno)</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label className="text-xs">Alíquota %</Label><Input type="number" step="0.01" value={s.aliquotaIcms || ''} onChange={(e) => s.setAliquotaIcms(parseFloat(e.target.value) || undefined)} placeholder="18" /></div>
                      <div className="space-y-2"><Label className="text-xs">MVA ST %</Label><Input type="number" step="0.01" value={s.mvaSt || ''} onChange={(e) => s.setMvaSt(parseFloat(e.target.value) || undefined)} placeholder="42" /></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">IPI</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs">CST</Label><Select value={s.cstIpi} onValueChange={s.setCstIpi}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{CST_IPI_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label className="text-xs">Alíquota %</Label><Input type="number" step="0.01" value={s.aliquotaIpi || ''} onChange={(e) => s.setAliquotaIpi(parseFloat(e.target.value) || undefined)} placeholder="5" /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-base font-semibold">PIS</Label><div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-xs">CST</Label><Select value={s.cstPis} onValueChange={s.setCstPis}><SelectTrigger><SelectValue placeholder="CST" /></SelectTrigger><SelectContent>{CST_PIS_COFINS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-xs">Alíquota %</Label><Input type="number" step="0.01" value={s.aliquotaPis || ''} onChange={(e) => s.setAliquotaPis(parseFloat(e.target.value) || undefined)} placeholder="1.65" /></div></div></div>
                    <div className="space-y-2"><Label className="text-base font-semibold">COFINS</Label><div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label className="text-xs">CST</Label><Select value={s.cstCofins} onValueChange={s.setCstCofins}><SelectTrigger><SelectValue placeholder="CST" /></SelectTrigger><SelectContent>{CST_PIS_COFINS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label className="text-xs">Alíquota %</Label><Input type="number" step="0.01" value={s.aliquotaCofins || ''} onChange={(e) => s.setAliquotaCofins(parseFloat(e.target.value) || undefined)} placeholder="7.60" /></div></div></div>
                  </div>
                  <div className="space-y-2"><Label>Observações Fiscais</Label><Textarea value={s.observacoesFiscais} onChange={(e) => s.setObservacoesFiscais(e.target.value)} placeholder="Informações adicionais fiscais..." rows={2} /></div>
                  {s.validacaoFiscal.erros.length > 0 && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription><ul className="list-disc list-inside">{s.validacaoFiscal.erros.map((e, i) => <li key={i}>{e}</li>)}</ul></AlertDescription></Alert>}
                  {s.validacaoFiscal.avisos.length > 0 && <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription><ul className="list-disc list-inside">{s.validacaoFiscal.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></AlertDescription></Alert>}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Processo */}
          {s.currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Controles de Processo</h3>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Criticidade</Label><Select value={s.criticidade} onValueChange={s.setCriticidade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CRITICIDADES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Armazenamento</Label><Select value={s.armazenamento} onValueChange={s.setArmazenamento}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ARMAZENAMENTOS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2"><Checkbox id="controla_lote" checked={s.controlaLote} onCheckedChange={(c) => s.setControlaLote(!!c)} /><label htmlFor="controla_lote" className="text-sm">Controla Lote</label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="controla_validade" checked={s.controlaValidade} onCheckedChange={(c) => s.setControlaValidade(!!c)} /><label htmlFor="controla_validade" className="text-sm">Controla Validade</label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="higroscopico" checked={s.higroscopico} onCheckedChange={(c) => s.setHigroscopico(!!c)} /><label htmlFor="higroscopico" className="text-sm">Higroscópico</label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="exige_premix" checked={s.exigePremix} onCheckedChange={(c) => s.setExigePremix(!!c)} /><label htmlFor="exige_premix" className="text-sm">Exige Premix</label></div>
                    <div className="flex items-center space-x-2"><Checkbox id="ativo" checked={s.ativo} onCheckedChange={(c) => s.setAtivo(!!c)} /><label htmlFor="ativo" className="text-sm">Ativo</label></div>
                  </div>
                  {(s.criticidade === 'CRITICO' || s.criticidade === 'ULTRA') && (
                    <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Item marcado como <strong>{s.criticidade}</strong> - lotes entrarão automaticamente em QUARENTENA e precisarão de COA validado para liberação.</AlertDescription></Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 6: Fornecedores */}
          {s.currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Fornecedores do Item</h3>
              <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <div><CardTitle className="text-base">Vincular Fornecedores</CardTitle><CardDescription>Adicione os fornecedores que fornecem este item</CardDescription></div>
                  <Button size="sm" onClick={() => s.setShowFornecedorForm(true)}><Plus className="h-4 w-4 mr-2" /> Vincular</Button>
                </CardHeader>
                <CardContent>
                  {s.fornecedores.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhum fornecedor vinculado.</p>
                  ) : (
                    <div className="space-y-3">
                      {s.fornecedores.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            {f.fornecedor_preferencial && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                            <div>
                              <p className="font-medium">{f.fornecedor_nome}</p>
                              <p className="text-sm text-muted-foreground">Código: {f.codigo_fornecedor || "-"} | Unidade: {f.unidade_compra_padrao} | Fator: {f.fator_para_unidade_interna}x</p>
                              {f.preco_referencia && <p className="text-sm text-muted-foreground">Preço: R$ {f.preco_referencia.toFixed(2)}</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => s.handleRemoveFornecedor(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              {s.showFornecedorForm && (
                <Card className="border-primary">
                  <CardHeader className="py-3"><CardTitle className="text-base">Novo Fornecedor</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Fornecedor *</Label><Select value={s.newFornecedor.fornecedor_id || ""} onValueChange={(v) => s.setNewFornecedor({...s.newFornecedor, fornecedor_id: v})}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{s.entidadesFornecedores?.map((e) => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>Código no Fornecedor</Label><Input value={s.newFornecedor.codigo_fornecedor || ""} onChange={(e) => s.setNewFornecedor({...s.newFornecedor, codigo_fornecedor: e.target.value})} placeholder="SKU do fornecedor" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>Unidade Compra</Label><Select value={s.newFornecedor.unidade_compra_padrao || "kg"} onValueChange={(v) => s.setNewFornecedor({...s.newFornecedor, unidade_compra_padrao: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNIDADES_FORNECEDOR.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>Fator Conversão</Label><Input type="number" value={s.newFornecedor.fator_para_unidade_interna || 1000} onChange={(e) => s.setNewFornecedor({...s.newFornecedor, fator_para_unidade_interna: parseFloat(e.target.value) || 1})} /></div>
                      <div className="space-y-2"><Label>Preço Referência</Label><Input type="number" step="0.01" value={s.newFornecedor.preco_referencia || ""} onChange={(e) => s.setNewFornecedor({...s.newFornecedor, preco_referencia: parseFloat(e.target.value) || undefined})} placeholder="R$ 0,00" /></div>
                    </div>
                    <div className="flex items-center space-x-2"><Checkbox id="preferencial" checked={s.newFornecedor.fornecedor_preferencial || false} onCheckedChange={(c) => s.setNewFornecedor({...s.newFornecedor, fornecedor_preferencial: !!c})} /><label htmlFor="preferencial" className="text-sm">Fornecedor Preferencial</label></div>
                    <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => s.setShowFornecedorForm(false)}>Cancelar</Button><Button onClick={s.handleAddFornecedor} disabled={!s.newFornecedor.fornecedor_id}>Adicionar</Button></div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 7: Aliases */}
          {s.currentStep === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Tag className="h-5 w-5" /> Aliases do Item</h3>
              <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <div><CardTitle className="text-base">Nomes Alternativos</CardTitle><CardDescription>Adicione descrições alternativas usadas por fornecedores ou sistemas</CardDescription></div>
                  <Button size="sm" onClick={() => s.setShowAliasForm(true)}><Plus className="h-4 w-4 mr-2" /> Novo Alias</Button>
                </CardHeader>
                <CardContent>
                  {s.aliases.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhum alias cadastrado. Aliases ajudam no matching automático de NF-e.</p>
                  ) : (
                    <div className="space-y-3">
                      {s.aliases.map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div><span className="inline-block px-2 py-1 text-xs bg-muted rounded mr-2">{TIPOS_ALIAS.find(t => t.value === a.tipo)?.label || a.tipo}</span><span>{a.texto}</span></div>
                          <Button variant="ghost" size="icon" onClick={() => s.handleRemoveAlias(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              {s.showAliasForm && (
                <Card className="border-primary">
                  <CardHeader className="py-3"><CardTitle className="text-base">Novo Alias</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Tipo</Label><Select value={s.newAlias.tipo || "ALIAS_FORNECEDOR"} onValueChange={(v) => s.setNewAlias({...s.newAlias, tipo: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ALIAS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>Texto do Alias *</Label><Input value={s.newAlias.texto || ""} onChange={(e) => s.setNewAlias({...s.newAlias, texto: e.target.value})} placeholder="Nome alternativo do produto" /></div>
                    </div>
                    <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => s.setShowAliasForm(false)}>Cancelar</Button><Button onClick={s.handleAddAlias} disabled={!s.newAlias.texto?.trim()}>Adicionar</Button></div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 8: Revisão */}
          {s.currentStep === 8 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Check className="h-5 w-5" /> Revisão Final</h3>
              <div className="grid grid-cols-2 gap-4">
                <Card><CardHeader className="py-3"><CardTitle className="text-sm">Identificação</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p><span className="text-muted-foreground">SKU:</span> {s.skuInterno || '(automático)'}</p><p><span className="text-muted-foreground">Nome:</span> {s.descricaoInterna}</p><p><span className="text-muted-foreground">Tipo:</span> {TIPOS_ITEM.find(t => t.value === s.tipoItem)?.label}</p>{s.descricaoComercial && <p><span className="text-muted-foreground">Comercial:</span> {s.descricaoComercial}</p>}</CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm">Unidades</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p><span className="text-muted-foreground">Fornecedor:</span> {formatarUnidade(s.unidadeFornecedor)}</p><p><span className="text-muted-foreground">Interna:</span> {formatarUnidade(s.unidadeInterna)}</p><p><span className="text-muted-foreground">Fator:</span> {s.fatorConversao}</p></CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm">Comercial</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p><span className="text-muted-foreground">Preço:</span> {s.precoUnitarioFornecedor ? `R$ ${s.precoUnitarioFornecedor.toFixed(2)}` : '-'}</p><p><span className="text-muted-foreground">MOQ:</span> {s.moq || '-'}</p><p><span className="text-muted-foreground">Lead Time:</span> {s.leadTimeDias ? `${s.leadTimeDias} dias` : '-'}</p></CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm">Fiscal</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p><span className="text-muted-foreground">NCM:</span> {s.ncm || '-'}</p><p><span className="text-muted-foreground">EAN:</span> {s.ean || '-'}</p><p><span className="text-muted-foreground">ICMS:</span> {s.cstIcms || '-'} {s.aliquotaIcms ? `(${s.aliquotaIcms}%)` : ''}</p></CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm">Fornecedores</CardTitle></CardHeader><CardContent className="text-sm">{s.fornecedores.length === 0 ? <p className="text-muted-foreground">Nenhum vinculado</p> : <ul className="space-y-1">{s.fornecedores.map(f => <li key={f.id} className="flex items-center gap-1">{f.fornecedor_preferencial && <Star className="h-3 w-3 text-amber-500" />}{f.fornecedor_nome}</li>)}</ul>}</CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm">Aliases</CardTitle></CardHeader><CardContent className="text-sm">{s.aliases.length === 0 ? <p className="text-muted-foreground">Nenhum cadastrado</p> : <ul className="space-y-1">{s.aliases.map(a => <li key={a.id}>{a.texto}</li>)}</ul>}</CardContent></Card>
                <Card className="col-span-2"><CardHeader className="py-3"><CardTitle className="text-sm">Processo</CardTitle></CardHeader><CardContent className="text-sm"><div className="flex flex-wrap gap-2"><span className="px-2 py-1 bg-muted rounded text-xs">Criticidade: {s.criticidade}</span><span className="px-2 py-1 bg-muted rounded text-xs">Armazenamento: {s.armazenamento}</span>{s.controlaLote && <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">Controla Lote</span>}{s.controlaValidade && <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">Controla Validade</span>}{s.higroscopico && <span className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs">Higroscópico</span>}{s.exigePremix && <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">Exige Premix</span>}</div></CardContent></Card>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button type="button" variant="outline" onClick={s.currentStep === 1 ? () => onOpenChange(false) : s.handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {s.currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {s.currentStep < TOTAL_STEPS ? (
            <Button type="button" onClick={s.handleNext} disabled={!s.canProceed()}>Avançar <ArrowRight className="h-4 w-4 ml-2" /></Button>
          ) : (
            <Button type="button" onClick={s.handleSubmit} variant="default"><Check className="h-4 w-4 mr-2" /> Salvar Produto</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
