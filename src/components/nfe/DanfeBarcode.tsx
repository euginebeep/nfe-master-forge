import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Código de barras CODE128C da chave de acesso (44 dígitos) no cabeçalho do DANFE.
 * Componente próprio por página — cada folha precisa do seu SVG/ref.
 */
export function DanfeBarcode({ chaveAcesso }: { chaveAcesso?: string | null }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const chave = (chaveAcesso ?? "").replace(/\D/g, "");

  useEffect(() => {
    if (barcodeRef.current && chave.length === 44) {
      JsBarcode(barcodeRef.current, chave, {
        format: "CODE128C",
        width: 1.2,
        height: 40,
        displayValue: false,
        margin: 0,
      });
    }
  }, [chave]);

  if (chave.length !== 44) return null;

  return <svg ref={barcodeRef} style={{ width: "100%", height: "40px" }} />;
}
