import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LocalDb } from "@/lib/local-db";
import { toast } from "sonner";

export default function ClearDataPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Clear specific collections
    LocalDb.setCollection('entidades', []);
    LocalDb.setCollection('entidade_contatos', []);
    LocalDb.setCollection('entidade_enderecos', []);
    LocalDb.setCollection('itens', []);
    LocalDb.setCollection('item_fornecedores', []);
    LocalDb.setCollection('item_alias', []);
    LocalDb.setCollection('estoque_lotes', []);
    LocalDb.setCollection('lote_documentos', []);
    
    toast.success("Produtos, fornecedores e clientes apagados!");
    navigate("/cadastros/produtos");
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Limpando dados...</p>
    </div>
  );
}
