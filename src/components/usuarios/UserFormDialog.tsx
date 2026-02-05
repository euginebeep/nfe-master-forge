import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Shield, Settings, Eye, Plus, Edit, Trash2 } from 'lucide-react';
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

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserWithProfile | null;
  onSave: (data: CreateUserData | UpdateUserData) => Promise<{ success: boolean }>;
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

export function UserFormDialog({ 
  open, 
  onOpenChange, 
  user, 
  onSave,
  existingPermissions = []
}: UserFormDialogProps) {
  const isEditing = !!user;
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome_completo: '',
    cargo: '',
    departamento: '' as AppDepartamento | '',
    role: 'visualizador' as AppRole,
    avatar_url: '',
    status: 'ATIVO',
  });

  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      });
      setPermissions([]);
    }
  }, [user, existingPermissions, open]);

  const handleRoleChange = (role: AppRole) => {
    setFormData(prev => ({ ...prev, role }));
    
    // Apply default permissions for the role
    if (role === 'admin') {
      // Admin has full access, no need for specific permissions
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
        return prev.map(p => 
          p.modulo === modulo ? { ...p, [field]: value } : p
        );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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
        };
        const result = await onSave(updateData);
        if (result.success) {
          onOpenChange(false);
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
        };
        const result = await onSave(createData);
        if (result.success) {
          onOpenChange(false);
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
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {formData.avatar_url ? (
                    <AvatarImage src={formData.avatar_url} />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {formData.nome_completo ? getInitials(formData.nome_completo) : 'U'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <Label htmlFor="avatar_url">URL da Foto</Label>
                  <Input
                    id="avatar_url"
                    value={formData.avatar_url}
                    onChange={e => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                    placeholder="https://..."
                  />
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
                        <div className="text-center">
                          <Eye className="h-4 w-4 mx-auto" />
                          Ver
                        </div>
                        <div className="text-center">
                          <Plus className="h-4 w-4 mx-auto" />
                          Criar
                        </div>
                        <div className="text-center">
                          <Edit className="h-4 w-4 mx-auto" />
                          Editar
                        </div>
                        <div className="text-center">
                          <Trash2 className="h-4 w-4 mx-auto" />
                          Excluir
                        </div>
                      </div>

                      {SYSTEM_MODULES.map(mod => {
                        const perm = getPermission(mod.id);
                        return (
                          <div key={mod.id} className="grid grid-cols-5 gap-2 items-center py-2 border-b border-border/50">
                            <div>
                              <p className="font-medium text-sm">{mod.label}</p>
                              <p className="text-xs text-muted-foreground">{mod.description}</p>
                            </div>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={perm.pode_visualizar}
                                onCheckedChange={(checked) => 
                                  updatePermission(mod.id, 'pode_visualizar', checked as boolean)
                                }
                              />
                            </div>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={perm.pode_criar}
                                onCheckedChange={(checked) => 
                                  updatePermission(mod.id, 'pode_criar', checked as boolean)
                                }
                              />
                            </div>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={perm.pode_editar}
                                onCheckedChange={(checked) => 
                                  updatePermission(mod.id, 'pode_editar', checked as boolean)
                                }
                              />
                            </div>
                            <div className="flex justify-center">
                              <Checkbox
                                checked={perm.pode_excluir}
                                onCheckedChange={(checked) => 
                                  updatePermission(mod.id, 'pode_excluir', checked as boolean)
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : (isEditing ? 'Salvar' : 'Criar Usuário')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
