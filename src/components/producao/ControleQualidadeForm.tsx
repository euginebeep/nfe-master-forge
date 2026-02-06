import { useState } from 'react';
import { 
  CheckCircle, XCircle, AlertTriangle, ClipboardCheck,
  Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ControleQualidadeOP, StatusQC } from '@/types/ordem-producao-industrial';
import { toast } from 'sonner';

interface ControleQualidadeFormProps {
  opId: string;
  qcExistente?: ControleQualidadeOP;
  pesoCapsulaAlvo?: number;
  onSalvar: (qc: Omit<ControleQualidadeOP, 'id' | 'op_id'>) => void;
  disabled?: boolean;
}

export function ControleQualidadeForm({ 
  opId, 
  qcExistente, 
  pesoCapsulaAlvo = 500,
  onSalvar,
  disabled = false
}: ControleQualidadeFormProps) {
  const [open, setOpen] = useState(false);
  
  // Form state
  const [aparenciaPo, setAparenciaPo] = useState(qcExistente?.aparencia_po || '');
  const [aparenciaConforme, setAparenciaConforme] = useState(qcExistente?.aparencia_conforme ?? true);
  
  const [fluidez, setFluidez] = useState(qcExistente?.fluidez || '');
  const [fluidezConforme, setFluidezConforme] = useState(qcExistente?.fluidez_conforme ?? true);
  
  const [homogeneidade, setHomogeneidade] = useState(qcExistente?.homogeneidade || '');
  const [homogeneidadeConforme, setHomogeneidadeConforme] = useState(qcExistente?.homogeneidade_conforme ?? true);
  
  const [pesoMedio, setPesoMedio] = useState(qcExistente?.peso_medio_capsulas_mg?.toString() || '');
  const [pesoConforme, setPesoConforme] = useState(qcExistente?.peso_conforme ?? true);
  
  const [observacoes, setObservacoes] = useState(qcExistente?.observacoes || '');
  const [motivoReprovacao, setMotivoReprovacao] = useState(qcExistente?.motivo_reprovacao || '');

  // Calcular tolerância do peso (±10% do peso alvo)
  const toleranciaPeso = {
    min: pesoCapsulaAlvo * 0.9,
    max: pesoCapsulaAlvo * 1.1,
  };

  const handleSalvar = (status: StatusQC) => {
    if (status === 'REPROVADO' && !motivoReprovacao.trim()) {
      toast.error('Informe o motivo da reprovação');
      return;
    }

    const pesoMedioNum = parseFloat(pesoMedio);
    
    const qc: Omit<ControleQualidadeOP, 'id' | 'op_id'> = {
      aparencia_po: aparenciaPo,
      aparencia_conforme: aparenciaConforme,
      fluidez,
      fluidez_conforme: fluidezConforme,
      homogeneidade,
      homogeneidade_conforme: homogeneidadeConforme,
      peso_medio_capsulas_mg: pesoMedioNum || undefined,
      peso_minimo_capsulas_mg: toleranciaPeso.min,
      peso_maximo_capsulas_mg: toleranciaPeso.max,
      peso_conforme: pesoConforme,
      status,
      observacoes,
      motivo_reprovacao: status === 'REPROVADO' ? motivoReprovacao : undefined,
      avaliado_por: 'Usuário', // TODO: Pegar do contexto de auth
      avaliado_em: new Date().toISOString(),
    };

    onSalvar(qc);
    setOpen(false);
  };

  const getStatusBadge = () => {
    if (!qcExistente) return null;
    
    switch (qcExistente.status) {
      case 'APROVADO':
        return (
          <Badge variant="default" className="bg-secondary">
            <CheckCircle className="h-3 w-3 mr-1" />
            APROVADO
          </Badge>
        );
      case 'REPROVADO':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            REPROVADO
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            PENDENTE
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-secondary" />
            Controle de Qualidade
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {qcExistente ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Aparência do Pó</Label>
                <p className="font-medium">{qcExistente.aparencia_po || '-'}</p>
                <Badge variant={qcExistente.aparencia_conforme ? 'secondary' : 'destructive'} className="mt-1">
                  {qcExistente.aparencia_conforme ? 'Conforme' : 'Não Conforme'}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Fluidez</Label>
                <p className="font-medium">{qcExistente.fluidez || '-'}</p>
                <Badge variant={qcExistente.fluidez_conforme ? 'secondary' : 'destructive'} className="mt-1">
                  {qcExistente.fluidez_conforme ? 'Conforme' : 'Não Conforme'}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Homogeneidade</Label>
                <p className="font-medium">{qcExistente.homogeneidade || '-'}</p>
                <Badge variant={qcExistente.homogeneidade_conforme ? 'secondary' : 'destructive'} className="mt-1">
                  {qcExistente.homogeneidade_conforme ? 'Conforme' : 'Não Conforme'}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Peso Médio Cápsulas</Label>
                <p className="font-medium font-mono">{qcExistente.peso_medio_capsulas_mg || '-'} mg</p>
                <Badge variant={qcExistente.peso_conforme ? 'secondary' : 'destructive'} className="mt-1">
                  {qcExistente.peso_conforme ? 'Conforme' : 'Não Conforme'}
                </Badge>
              </div>
            </div>
            
            {qcExistente.observacoes && (
              <div>
                <Label className="text-muted-foreground text-xs">Observações</Label>
                <p className="text-sm">{qcExistente.observacoes}</p>
              </div>
            )}
            
            {qcExistente.status === 'REPROVADO' && qcExistente.motivo_reprovacao && (
              <div className="p-3 bg-destructive/10 border border-destructive rounded">
                <Label className="text-destructive text-xs">Motivo da Reprovação</Label>
                <p className="text-sm font-medium text-destructive">{qcExistente.motivo_reprovacao}</p>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Avaliado por: {qcExistente.avaliado_por} em {qcExistente.avaliado_em ? new Date(qcExistente.avaliado_em).toLocaleString('pt-BR') : '-'}
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Controle de Qualidade pendente</p>
            <Button onClick={() => setOpen(true)} disabled={disabled}>
              <Scale className="h-4 w-4 mr-2" />
              Registrar QC
            </Button>
          </div>
        )}

        {/* Dialog de QC */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Controle de Qualidade
              </DialogTitle>
              <DialogDescription>
                Registre os testes de qualidade do lote produzido
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Aparência */}
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2">
                  <Label>Aparência do Pó</Label>
                  <Input
                    placeholder="Ex: Pó fino, homogêneo, cor bege claro"
                    value={aparenciaPo}
                    onChange={(e) => setAparenciaPo(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="aparencia-conforme"
                    checked={aparenciaConforme}
                    onCheckedChange={(c) => setAparenciaConforme(!!c)}
                  />
                  <Label htmlFor="aparencia-conforme">Conforme</Label>
                </div>
              </div>

              {/* Fluidez */}
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2">
                  <Label>Fluidez</Label>
                  <Input
                    placeholder="Ex: Boa fluidez, sem aglomerados"
                    value={fluidez}
                    onChange={(e) => setFluidez(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fluidez-conforme"
                    checked={fluidezConforme}
                    onCheckedChange={(c) => setFluidezConforme(!!c)}
                  />
                  <Label htmlFor="fluidez-conforme">Conforme</Label>
                </div>
              </div>

              {/* Homogeneidade */}
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2">
                  <Label>Homogeneidade</Label>
                  <Input
                    placeholder="Ex: Mistura homogênea, sem segregação"
                    value={homogeneidade}
                    onChange={(e) => setHomogeneidade(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="homogeneidade-conforme"
                    checked={homogeneidadeConforme}
                    onCheckedChange={(c) => setHomogeneidadeConforme(!!c)}
                  />
                  <Label htmlFor="homogeneidade-conforme">Conforme</Label>
                </div>
              </div>

              {/* Peso Médio */}
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2">
                  <Label>Peso Médio das Cápsulas (mg)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`Alvo: ${pesoCapsulaAlvo} mg`}
                      value={pesoMedio}
                      onChange={(e) => setPesoMedio(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({toleranciaPeso.min.toFixed(0)} - {toleranciaPeso.max.toFixed(0)} mg)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="peso-conforme"
                    checked={pesoConforme}
                    onCheckedChange={(c) => setPesoConforme(!!c)}
                  />
                  <Label htmlFor="peso-conforme">Conforme</Label>
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações adicionais..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Motivo Reprovação (condicional) */}
              <div>
                <Label>Motivo da Reprovação (se aplicável)</Label>
                <Textarea
                  placeholder="Descreva o motivo da reprovação..."
                  value={motivoReprovacao}
                  onChange={(e) => setMotivoReprovacao(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleSalvar('REPROVADO')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reprovar
              </Button>
              <Button
                className="bg-secondary hover:bg-secondary/90"
                onClick={() => handleSalvar('APROVADO')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
