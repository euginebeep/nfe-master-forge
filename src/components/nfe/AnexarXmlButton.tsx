import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnexarXmlButton({ notaId, chaveNfe, onDone, variant = 'icon' }: {
  notaId: string; chaveNfe: string; onDone: () => void;
  /** icon = botão ícone na tabela; menu = item do dropdown */
  variant?: 'icon' | 'menu';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [salvando, setSalvando] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSalvando(true);
    try {
      const xml = await file.text();
      const m = xml.match(/Id="NFe(\d{44})"/) || xml.match(/<chNFe>(\d{44})<\/chNFe>/);
      const chaveXml = m?.[1];
      if (!chaveXml) {
        toast.error("Não encontrei a chave da NF-e no arquivo. É um XML de NF-e válido?");
        return;
      }
      if (chaveXml !== chaveNfe) {
        toast.error(`Este XML é de outra nota (…${chaveXml.slice(-6)} ≠ …${chaveNfe.slice(-6)}).`);
        return;
      }
      const { error } = await supabase.from("notas_entrada").update({ xml_raw: xml }).eq("id", notaId);
      if (error) { toast.error(`Falha ao salvar XML: ${error.message || error.code}`); return; }
      toast.success("XML anexado à nota.");
      onDone();
    } catch (err: any) {
      toast.error(`Erro ao ler/salvar o XML: ${err?.message || err?.code || "desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={handleFile} />
      {variant === 'menu' ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={salvando}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          className="w-full justify-start gap-2 h-8 px-2 font-normal text-amber-700 hover:text-amber-800"
        >
          <FileUp className="h-4 w-4" />
          Anexar XML
        </Button>
      ) : (
        <Button variant="ghost" size="icon" disabled={salvando}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          title="Anexar XML" className="text-amber-600 hover:text-amber-700">
          <FileUp className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
