import { useMemo } from "react";
import { code128cSvg } from "@/lib/code128";

export function CodigoBarrasChave({ chave }: { chave?: string | null }) {
  const svg = useMemo(() => {
    const d = (chave ?? "").replace(/\D/g, "");
    return d.length === 44 ? code128cSvg(d) : null;
  }, [chave]);

  if (!svg) {
    // Sem chave não se desenha barra nenhuma. Área em branco é honesta;
    // listra falsa sugere que existe algo legível.
    return (
      <div style={{
        height: "13mm", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "5.5pt", color: "#999",
      }}>
        Código de barras disponível após a autorização
      </div>
    );
  }

  return (
    <div
      style={{ height: "13mm", display: "flex", justifyContent: "center" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
