import { useState } from "react";
import { Database, Upload, Loader2, CheckCircle, AlertCircle, Package, Building2, Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  migrateAllToSupabase, 
  hasLocalDataToMigrate, 
  getLocalDataCounts,
  type MigrationStats 
} from "@/lib/supabase-sync";

export default function MigrarDadosPage() {
  const [migrating, setMigrating] = useState(false);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [progress, setProgress] = useState(0);
  
  const localCounts = getLocalDataCounts();
  const hasData = hasLocalDataToMigrate();

  const handleMigrate = async () => {
    if (!hasData) {
      toast.info("Não há dados locais para migrar");
      return;
    }

    setMigrating(true);
    setProgress(10);

    try {
      setProgress(30);
      const result = await migrateAllToSupabase();
      setProgress(100);
      setStats(result);

      const totalMigrated = 
        result.entidades.migrated + 
        result.itens.migrated + 
        result.lotes.migrated;

      const totalErrors = 
        result.entidades.errors + 
        result.itens.errors + 
        result.lotes.errors;

      if (totalErrors === 0) {
        toast.success(`Migração concluída! ${totalMigrated} registros sincronizados.`);
      } else {
        toast.warning(`Migração concluída com ${totalErrors} erros.`);
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error("Erro durante a migração. Verifique o console.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Migrar Dados para Nuvem"
        description="Sincronize os dados do localStorage para o banco de dados Supabase"
        icon={Database}
      />

      <div className="space-y-6">
        {/* Current Local Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Dados Locais (localStorage)
            </CardTitle>
            <CardDescription>
              Dados armazenados localmente neste navegador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{localCounts.entidades}</p>
                  <p className="text-sm text-muted-foreground">Entidades</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{localCounts.itens}</p>
                  <p className="text-sm text-muted-foreground">Produtos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Boxes className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{localCounts.lotes}</p>
                  <p className="text-sm text-muted-foreground">Lotes</p>
                </div>
              </div>
            </div>

            {!hasData && (
              <div className="mt-4 p-4 bg-muted rounded-lg text-center">
                <p className="text-muted-foreground">Nenhum dado local para migrar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Migration Action */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Migrar para Supabase
            </CardTitle>
            <CardDescription>
              Envie todos os dados locais para o banco de dados em nuvem.
              Os dados serão preservados localmente como backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {migrating && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Migrando dados... {progress}%
                </p>
              </div>
            )}

            <Button 
              onClick={handleMigrate} 
              disabled={migrating || !hasData}
              className="w-full"
              size="lg"
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Iniciar Migração
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Migration Results */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Resultado da Migração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <MigrationRow 
                  label="Entidades" 
                  total={stats.entidades.total}
                  migrated={stats.entidades.migrated}
                  errors={stats.entidades.errors}
                />
                <MigrationRow 
                  label="Contatos" 
                  total={stats.contatos.total}
                  migrated={stats.contatos.migrated}
                  errors={stats.contatos.errors}
                />
                <MigrationRow 
                  label="Endereços" 
                  total={stats.enderecos.total}
                  migrated={stats.enderecos.migrated}
                  errors={stats.enderecos.errors}
                />
                <MigrationRow 
                  label="Produtos" 
                  total={stats.itens.total}
                  migrated={stats.itens.migrated}
                  errors={stats.itens.errors}
                />
                <MigrationRow 
                  label="Fornecedores (Item)" 
                  total={stats.itemFornecedores.total}
                  migrated={stats.itemFornecedores.migrated}
                  errors={stats.itemFornecedores.errors}
                />
                <MigrationRow 
                  label="Lotes" 
                  total={stats.lotes.total}
                  migrated={stats.lotes.migrated}
                  errors={stats.lotes.errors}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MigrationRow({ label, total, migrated, errors }: { 
  label: string; 
  total: number; 
  migrated: number; 
  errors: number 
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Total: {total}</span>
        <span className="text-primary flex items-center gap-1">
          <CheckCircle className="h-4 w-4" />
          {migrated}
        </span>
        {errors > 0 && (
          <span className="text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors}
          </span>
        )}
      </div>
    </div>
  );
}
