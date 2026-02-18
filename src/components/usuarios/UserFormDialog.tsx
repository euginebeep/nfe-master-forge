import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Shield, Eye, Plus, Edit, Trash2, Upload, Loader2, AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  type UserWithProfile, 
  type ModulePermission, 
  type CreateUserData, 
  type UpdateUserData,
  FACTORY_ROLES, 
  SYSTEM_MODULES 
} from '@/hooks/use-users';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type AppDepartamento = Database['public']['Enums']['app_departamento'];
type Sexo = 'MASCULINO' | 'FEMININO' | 'NAO_INFORMADO';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserWithProfile | null;
  onSave: (data: CreateUserData | UpdateUserData) => Promise<{ success: boolean; error?: string }>;
  existingPermissions?: ModulePermission[];
}

const DEPARTAMENTOS: { value: AppDepartamento; label: string }[] = [
  { value: 'DIRETORIA', label: 'Diretoria' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'COMPRAS', label: 'Compras' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'ESTOQUE', label: 'Estoque' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'QUALIDADE', label: 'Qualidade' },
  { value: 'RH', label: 'RH' },
  { value: 'TI', label: 'TI' },
];

// Converte "1990-05-20" → "20/05/1990"
function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Converte "20/05/1990" → "1990-05-20" ou undefined se inválido
// Usa validação sem Date() para evitar bugs de timezone
function displayToIso(texto: string): string | undefined {
  const cleaned = texto.replace(/\D/g, '');
  if (cleaned.length !== 8) return undefined;
  const dia = parseInt(cleaned.slice(0, 2), 10);
  const mes = parseInt(cleaned.slice(2, 4), 10);
  const ano = parseInt(cleaned.slice(4, 8), 10);
  // Validação básica sem usar Date() (evita bugs de timezone)
  if (mes < 1 || mes > 12) return undefined;
  if (dia < 1 || dia > 31) return undefined;
  if (ano < 1900 || ano > new Date().getFullYear()) return undefined;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Aplica máscara dd/mm/aaaa
function maskDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function UserFormDialog({ 
  open, 
  onOpenChange, 
  user, 
  onSave,
  existingPermissions = []
}: UserFormDialogProps) {
  const isEditing = !!user;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome_completo: '',
    cargo: '',
    departamento: '' as AppDepartamento | '',
    role: 'visualizador' as AppRole,
    avatar_url: '',
    status: 'ATIVO',
    sexo: 'NAO_INFORMADO' as Sexo,
    data_nascimento_texto: '',
  });

  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string; tip?: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        password: '',
        nome_completo: user.nome_completo,
        cargo: user.cargo || '',
        departamento: user.departamento || '',
        role: user.role,
        avatar_url: user.avatar_url || '',
        status: user.status,
        sexo: ((user as any).sexo as Sexo) || 'NAO_INFORMADO',
        data_nascimento_texto: isoToDisplay((user as any).data_nascimento),
      });
      setPermissions(existingPermissions);
    } else {
      setFormData({
        email: '',
        password: '',
        nome_completo: '',
        cargo: '',
        departamento: '',
        role: 'visualizador',
        avatar_url: '',
        status: 'ATIVO',
        sexo: 'NAO_INFORMADO',
        data_nascimento_texto: '',
      });
      setPermissions([]);
    }
    setErrorInfo(null);
  }, [user, existingPermissions, open]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Foto deve ter no máximo 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('Foto enviada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRoleChange = (role: AppRole) => {
    setFormData(prev => ({ ...prev, role }));
    if (role === 'admin') {
      setPermissions([]);
    } else {
      const roleConfig = FACTORY_ROLES[role];
      const newPermissions: ModulePermission[] = SYSTEM_MODULES.map(mod => ({
        modulo: mod.id,
        pode_visualizar: roleConfig.defaultModules.includes(mod.id),
        pode_criar: role !== 'visualizador' && roleConfig.defaultModules.includes(mod.id),
        pode_editar: role !== 'visualizador' && roleConfig.defaultModules.includes(mod.id),
        pode_excluir: (role === 'gerente' || role === 'supervisor') && roleConfig.defaultModules.includes(mod.id),
      }));
      setPermissions(newPermissions);
    }
  };

  const updatePermission = (modulo: string, field: keyof ModulePermission, value: boolean) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.modulo === modulo);
      if (existing) {
        return prev.map(p => p.modulo === modulo ? { ...p, [field]: value } : p);
      } else {
        return [...prev, {
          modulo,
          pode_visualizar: field === 'pode_visualizar' ? value : false,
          pode_criar: field === 'pode_criar' ? value : false,
          pode_editar: field === 'pode_editar' ? value : false,
          pode_excluir: field === 'pode_excluir' ? value : false,
        }];
      }
    });
  };

  const getPermission = (modulo: string): ModulePermission => {
    return permissions.find(p => p.modulo === modulo) || {
      modulo,
      pode_visualizar: false,
      pode_criar: false,
      pode_editar: false,
      pode_excluir: false,
    };
  };

  const parseErrorMessage = (rawError: string): { title: string; message: string; tip?: string } => {
    const msg = rawError.toLowerCase();

    if (msg.includes('user already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
      return {
        title: 'E-mail já cadastrado',
        message: `O e-mail "${formData.email}" já está sendo usado por outro usuário no sistema.`,
        tip: 'Use um endereço de e-mail diferente ou edite o usuário existente.',
      };
    }
    if (msg.includes('invalid email') || msg.includes('e-mail inválido')) {
      return {
        title: 'E-mail inválido',
        message: 'O endereço de e-mail informado não é válido.',
        tip: 'Verifique se o e-mail está correto (ex: nome@empresa.com).',
      };
    }
    if (msg.includes('password') && (msg.includes('short') || msg.includes('weak') || msg.includes('6'))) {
      return {
        title: 'Senha muito curta',
        message: 'A senha precisa ter no mínimo 6 caracteres.',
        tip: 'Escolha uma senha mais longa com letras e números.',
      };
    }
    if (msg.includes('not authenticated') || msg.includes('unauthorized') || msg.includes('401')) {
      return {
        title: 'Sessão expirada',
        message: 'Sua sessão de administrador expirou.',
        tip: 'Faça logout e entre novamente para continuar.',
      };
    }
    if (msg.includes('permission') || msg.includes('forbidden') || msg.includes('403')) {
      return {
        title: 'Sem permissão',
        message: 'Você não tem permissão para realizar esta ação.',
        tip: 'Apenas administradores podem criar ou editar usuários.',
      };
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
      return {
        title: 'Erro de conexão',
        message: 'Não foi possível se conectar ao servidor.',
        tip: 'Verifique sua conexão com a internet e tente novamente.',
      };
    }
    return {
      title: 'Erro ao salvar usuário',
      message: rawError || 'Ocorreu um erro inesperado.',
      tip: 'Tente novamente. Se o problema persistir, contate o suporte.',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorInfo(null);

    try {
      const extraFields = {
        sexo: formData.sexo,
        data_nascimento: displayToIso(formData.data_nascimento_texto),
      };

      if (isEditing) {
        const updateData: UpdateUserData = {
          user_id: user.id,
          nome_completo: formData.nome_completo,
          cargo: formData.cargo || undefined,
          departamento: formData.departamento || undefined,
          role: formData.role,
          avatar_url: formData.avatar_url || undefined,
          status: formData.status,
          permissions: formData.role !== 'admin' ? permissions : undefined,
          new_password: formData.password || undefined,
          ...extraFields,
        };
        const result = await onSave(updateData);
        if (result.success) {
          onOpenChange(false);
        } else {
          setErrorInfo(parseErrorMessage(result.error || 'Erro ao atualizar usuário'));
        }
      } else {
        const createData: CreateUserData = {
          email: formData.email,
          password: formData.password,
          nome_completo: formData.nome_completo,
          cargo: formData.cargo || undefined,
          departamento: formData.departamento || undefined,
          role: formData.role,
          avatar_url: formData.avatar_url || undefined,
          permissions: formData.role !== 'admin' ? permissions : undefined,
          ...extraFields,
        };
        const result = await onSave(createData);
        if (result.success) {
          onOpenChange(false);
        } else {
          setErrorInfo(parseErrorMessage(result.error || 'Erro ao criar usuário'));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="permissoes" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              {/* Foto do colaborador */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-border">
                    {formData.avatar_url ? (
                      <AvatarImage src={formData.avatar_url} />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {formData.nome_completo ? getInitials(formData.nome_completo) : 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {uploadingPhoto && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Foto do Colaborador</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingPhoto ? 'Enviando...' : 'Enviar Foto'}
                    </Button>
                    {formData.avatar_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, avatar_url: '' }))}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP. Máx 5MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_completo">Nome Completo *</Label>
                  <Input
                    id="nome_completo"
                    value={formData.nome_completo}
                    onChange={e => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={isEditing}
                    required={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    {isEditing ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required={!isEditing}
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={formData.cargo}
                    onChange={e => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                    placeholder="Ex: Analista de Qualidade"
                  />
                </div>

                {/* Sexo */}
                <div className="space-y-2">
                  <Label>Sexo</Label>
                  <Select
                    value={formData.sexo}
                    onValueChange={(value: Sexo) => setFormData(prev => ({ ...prev, sexo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NAO_INFORMADO">Não informado</SelectItem>
                      <SelectItem value="MASCULINO">Masculino</SelectItem>
                      <SelectItem value="FEMININO">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data de Nascimento - Input simples com máscara */}
                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input
                    id="data_nascimento"
                    value={formData.data_nascimento_texto}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      data_nascimento_texto: maskDate(e.target.value)
                    }))}
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    value={formData.departamento}
                    onValueChange={(value: AppDepartamento) =>
                      setFormData(prev => ({ ...prev, departamento: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTAMENTOS.map(dep => (
                        <SelectItem key={dep.value} value={dep.value}>
                          {dep.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Perfil de Acesso</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: AppRole) => handleRoleChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FACTORY_ROLES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {FACTORY_ROLES[formData.role]?.description}
                  </p>
                </div>

                {isEditing && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="INATIVO">Inativo</SelectItem>
                        <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="permissoes" className="mt-4">
              {formData.role === 'admin' ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 text-primary">
                      <Shield className="h-8 w-8" />
                      <div>
                        <p className="font-semibold">Administrador - Acesso Total</p>
                        <p className="text-sm text-muted-foreground">
                          Este perfil possui acesso irrestrito a todos os módulos do sistema.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Permissões por Módulo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                        <div>Módulo</div>
                        <div className="text-center"><Eye className="h-4 w-4 mx-auto" />Ver</div>
                        <div className="text-center"><Plus className="h-4 w-4 mx-auto" />Criar</div>
                        <div className="text-center"><Edit className="h-4 w-4 mx-auto" />Editar</div>
                        <div className="text-center"><Trash2 className="h-4 w-4 mx-auto" />Excluir</div>
                      </div>

                      {SYSTEM_MODULES.map(mod => {
                        const perm = getPermission(mod.id);
                        return (
                          <div key={mod.id} className="grid grid-cols-5 gap-2 items-center py-2 border-b border-border/50">
                            <div>
                              <p className="font-medium text-sm">{mod.label}</p>
                              <p className="text-xs text-muted-foreground">{mod.description}</p>
                            </div>
                            {(['pode_visualizar', 'pode_criar', 'pode_editar', 'pode_excluir'] as const).map(field => (
                              <div key={field} className="flex justify-center">
                                <Checkbox
                                  checked={perm[field]}
                                  onCheckedChange={(checked) =>
                                    updatePermission(mod.id, field, checked as boolean)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {errorInfo && (
            <div className="mt-4">
              <Alert variant="destructive" className="relative">
                <AlertCircle className="h-5 w-5" />
                <button
                  type="button"
                  onClick={() => setErrorInfo(null)}
                  className="absolute top-3 right-3 text-destructive/70 hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <AlertTitle className="font-semibold text-base pr-6">
                  {errorInfo.title}
                </AlertTitle>
                <AlertDescription className="mt-1 space-y-1">
                  <p>{errorInfo.message}</p>
                  {errorInfo.tip && (
                    <p className="text-sm font-medium opacity-80">
                      💡 {errorInfo.tip}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (isEditing ? 'Salvar Alterações' : 'Criar Usuário')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
