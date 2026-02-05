import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LocalDb, seedInitialData } from "@/lib/local-db";
import { toast } from "sonner";

export default function ClearDataPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Limpa absolutamente tudo do LocalDb (todas as chaves legacy_erp_*)
    LocalDb.clearAll();

    // Recria o registro mínimo da empresa (em branco) para evitar telas sem contexto
    seedInitialData();

    toast.success("Todos os cadastros foram apagados!");
    navigate("/cadastros/produtos", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Limpando dados...</p>
    </div>
  );
}