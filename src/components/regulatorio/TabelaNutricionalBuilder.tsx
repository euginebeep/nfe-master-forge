import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, Trash2 } from 'lucide-react';
import { toast } from "sonner";

interface Nutriente {
  id: string;
  nome: string;
  quantidade: string;
  vd: string;
}

export const TabelaNutricionalBuilder: React.FC<{ initialData?: any }> = ({ initialData }) => {
  const [porcao, setPorcao] = useState("2 cápsulas (1000 mg)");
  const [nutrientes, setNutrientes] = useState<Nutriente[]>(() => {
    if (initialData?.ativos) {
      return initialData.ativos.map((a: any, i: number) => ({
        id: i.toString(),
        nome: a.nome,
        quantidade: `${a.dose} ${a.unit}`,
        vd: '**'
      }));
    }
    return [
      { id: '1', nome: 'Vitamina D3', quantidade: '50 mcg', vd: '250%' },
      { id: '2', nome: 'Zinco', quantidade: '11 mg', vd: '100%' }
    ];
  });

  // Atualizar quando os dados iniciais mudarem
  React.useEffect(() => {
    if (initialData?.ativos) {
      setNutrientes(initialData.ativos.map((a: any, i: number) => ({
        id: i.toString(),
        nome: a.nome,
        quantidade: `${a.dose} ${a.unit}`,
        vd: '**'
      })));
      if (initialData.sugestao_capsulas) {
        setPorcao(`${initialData.sugestao_capsulas.n} caps (${initialData.sugestao_capsulas.tamanho})`);
      }
    }
  }, [initialData]);


  const addNutriente = () => {
    setNutrientes([...nutrientes, { id: Date.now().toString(), nome: '', quantidade: '', vd: '' }]);
  };

  const updateNutriente = (id: string, field: keyof Nutriente, value: string) => {
    setNutrientes(nutrientes.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const removeNutriente = (id: string) => {
    setNutrientes(nutrientes.filter(n => n.id !== id));
  };

  const copyToClipboard = () => {
    const text = `INFORMAÇÃO NUTRICIONAL\nPorção: ${porcao}\n\nNutriente | Qtd | %VD\n` + 
      nutrientes.map(n => `${n.nome} | ${n.quantidade} | ${n.vd}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success("Tabela copiada como texto!");
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Configurador de Tabela</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Porção</label>
            <Input value={porcao} onChange={e => setPorcao(e.target.value)} placeholder="Ex: 2 cápsulas (1.2g)" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Nutrientes</label>
              <Button size="sm" variant="outline" onClick={addNutriente}><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            <Table>
              <TableBody>
                {nutrientes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="p-1"><Input size={30} value={n.nome} onChange={e => updateNutriente(n.id, 'nome', e.target.value)} placeholder="Nutriente" /></TableCell>
                    <TableCell className="p-1"><Input size={10} value={n.quantidade} onChange={e => updateNutriente(n.id, 'quantidade', e.target.value)} placeholder="Qtd" /></TableCell>
                    <TableCell className="p-1"><Input size={5} value={n.vd} onChange={e => updateNutriente(n.id, 'vd', e.target.value)} placeholder="%VD" /></TableCell>
                    <TableCell className="p-1">
                      <Button variant="ghost" size="icon" onClick={() => removeNutriente(n.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white text-black p-8 min-h-[400px]">
        <div className="border-4 border-black p-2 max-w-sm mx-auto font-sans">
          <h2 className="text-center font-black text-xl leading-tight border-b-2 border-black pb-1 mb-1 uppercase">Informação Nutricional</h2>
          <p className="text-xs font-bold border-b-2 border-black pb-1 mb-1">Porção: {porcao}</p>
          <div className="grid grid-cols-3 text-[10px] font-bold border-b-2 border-black mb-1">
            <div className="col-span-1"></div>
            <div className="text-right">Qtd. por porção</div>
            <div className="text-right">%VD (*)</div>
          </div>
          {nutrientes.map((n, i) => (
            <div key={n.id} className={`grid grid-cols-3 text-[10px] border-b border-black py-0.5 ${i % 2 === 0 ? '' : 'font-bold'}`}>
              <div className="col-span-1 truncate">{n.nome || 'Nutriente'}</div>
              <div className="text-right">{n.quantidade || '0'}</div>
              <div className="text-right">{n.vd || '0%'}</div>
            </div>
          ))}
          <div className="mt-2 text-[8px] leading-tight">
            <p>* % Valores Diários com base em uma dieta de 2.000 kcal ou 8.400 kJ. Seus valores diários podem ser maiores ou menores dependendo de suas necessidades energéticas.</p>
            <p>** VD não estabelecido.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <Button onClick={copyToClipboard} variant="outline" className="text-black border-black hover:bg-black hover:text-white">
            <Copy className="w-4 h-4 mr-2" /> Copiar Texto Formatado
          </Button>
        </div>
      </Card>
    </div>
  );
};
