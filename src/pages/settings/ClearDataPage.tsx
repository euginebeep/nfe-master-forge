import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LocalDb } from "@/lib/local-db";
import { toast } from "sonner";

export default function ClearDataPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Limpa absolutamente tudo do LocalDb (todas as chaves legacy_erp_*)
    LocalDb.clearAll();

    toast.success("Dados locais limpos com sucesso!");
    navigate("/cadastros/produtos", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Limpando dados...</p>
    </div>
  );
}