import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LocalDb } from "@/lib/local-db";
import { toast } from "sonner";

export default function ClearDataPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    LocalDb.clearAll();
    toast.success("Todos os dados foram apagados. Sistema limpo!");
    navigate("/");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Limpando dados...</p>
    </div>
  );
}
