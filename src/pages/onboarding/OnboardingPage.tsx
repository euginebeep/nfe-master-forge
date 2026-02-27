import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, MapPin, FileText, Check, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buscarCep } from '@/lib/viacep';
import { maskCNPJ, maskCEP, maskPhone } from '@/lib/masks';

interface OnboardingData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  ie: string;
  regime_tributario: string;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_nro: string;
  endereco_compl: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cmun: string;
  telefone: string;
  email_fiscal: string;
}

const STEPS = [
  { title: 'Dados da Empresa', icon: Building2, description: 'CNPJ, Razão Social e regime tributário' },
  { title: 'Endereço', icon: MapPin, description: 'Localização da empresa' },
  { title: 'Contato & Fiscal', icon: FileText, description: 'Dados de contato e configurações fiscais' },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    razao_social: '', nome_fantasia: '', cnpj: '', ie: '', regime_tributario: '',
    endereco_cep: '', endereco_logradouro: '', endereco_nro: '', endereco_compl: '',
    endereco_bairro: '', endereco_cidade: '', endereco_uf: '', endereco_cmun: '',
    telefone: '', email_fiscal: '',
  });

  const update = (field: keyof OnboardingData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleCepBlur = async () => {
    const cep = data.endereco_cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const result = await buscarCep(cep);
      if (result) {
        setData(prev => ({
          ...prev,
          endereco_logradouro: result.logradouro,
          endereco_bairro: result.bairro,
          endereco_cidade: result.cidade,
          endereco_uf: result.uf,
          endereco_cmun: result.cmun,
        }));
      }
    } catch {
      toast.error('CEP não encontrado');
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleSubmit = async () => {
    if (!data.razao_social || !data.cnpj) {
      toast.error('Preencha pelo menos Razão Social e CNPJ');
      return;
    }
    setIsLoading(true);
    try {
      const cleanCnpj = data.cnpj.replace(/\D/g, '');
      const companyPayload = {
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia || null,
        cnpj: cleanCnpj,
        ie: data.ie || null,
        regime_tributario: data.regime_tributario || null,
        endereco_cep: data.endereco_cep.replace(/\D/g, '') || null,
        endereco_logradouro: data.endereco_logradouro || null,
        endereco_nro: data.endereco_nro || null,
        endereco_compl: data.endereco_compl || null,
        endereco_bairro: data.endereco_bairro || null,
        endereco_cidade: data.endereco_cidade || null,
        endereco_uf: data.endereco_uf || null,
        endereco_cmun: data.endereco_cmun || null,
        telefone: data.telefone.replace(/\D/g, '') || null,
        email_fiscal: data.email_fiscal || null,
      };

      // 1. Tentar criar a company
      const newId = crypto.randomUUID();
      const { error } = await supabase.from('company').insert({ ...companyPayload, id: newId });

      let companyIdToLink: string = newId;

      if (error) {
        // CNPJ duplicado = empresa órfã de tentativa anterior → reutilizar
        if (error.code === '23505' && error.message.includes('company_cnpj_key')) {
          const { data: existing } = await supabase
            .from('company')
            .select('id')
            .eq('cnpj', cleanCnpj)
            .maybeSingle();
          if (!existing) throw error;
          companyIdToLink = existing.id as string;
          // Atualizar com dados mais recentes
          await supabase.from('company').update(companyPayload).eq('id', companyIdToLink);
        } else {
          throw error;
        }
      }

      // 2. Vincular company_id ao profile do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ company_id: companyIdToLink } as any)
          .eq('id', user.id);

        if (profileError) {
          console.error('Erro ao vincular empresa ao perfil:', profileError);
        }
      }

      toast.success('Empresa configurada com sucesso!');
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar empresa';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao BrainX ERP</h1>
          <p className="text-muted-foreground text-sm">Configure sua empresa para começar</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>CNPJ *</Label>
                    <Input value={data.cnpj} onChange={e => update('cnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Razão Social *</Label>
                    <Input value={data.razao_social} onChange={e => update('razao_social', e.target.value)} placeholder="Nome jurídico da empresa" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input value={data.nome_fantasia} onChange={e => update('nome_fantasia', e.target.value)} placeholder="Nome comercial" />
                  </div>
                  <div className="space-y-2">
                    <Label>Regime Tributário</Label>
                    <Select value={data.regime_tributario} onValueChange={v => update('regime_tributario', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Inscrição Estadual</Label>
                    <Input value={data.ie} onChange={e => update('ie', e.target.value)} placeholder="ISENTO ou número" />
                  </div>
                </motion.div>
              )}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={data.endereco_cep} onChange={e => update('endereco_cep', maskCEP(e.target.value))} onBlur={handleCepBlur} placeholder="00000-000" />
                    {isFetchingCep && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço...</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Logradouro</Label>
                      <Input value={data.endereco_logradouro} onChange={e => update('endereco_logradouro', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nº</Label>
                      <Input value={data.endereco_nro} onChange={e => update('endereco_nro', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input value={data.endereco_compl} onChange={e => update('endereco_compl', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={data.endereco_bairro} onChange={e => update('endereco_bairro', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label>Cidade</Label>
                      <Input value={data.endereco_cidade} onChange={e => update('endereco_cidade', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>UF</Label>
                      <Input value={data.endereco_uf} onChange={e => update('endereco_uf', e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
                    </div>
                  </div>
                </motion.div>
              )}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={data.telefone} onChange={e => update('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail Fiscal</Label>
                    <Input type="email" value={data.email_fiscal} onChange={e => update('email_fiscal', e.target.value)} placeholder="fiscal@empresa.com" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-between mt-6">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)}>
                  Próximo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Check className="h-4 w-4 mr-1" /> Concluir</>}
                </Button>
              )}
            </div>

            <p className="text-center mt-4 text-xs text-muted-foreground">
              O cadastro da empresa é obrigatório para utilizar o sistema.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
