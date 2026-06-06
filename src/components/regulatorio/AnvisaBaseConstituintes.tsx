import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ANVISA_LIMITS } from "@/lib/anvisa-limits";
import { Search, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";

export const AnvisaBaseConstituintes: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const limitsArray = Object.entries(ANVISA_LIMITS).map(([key, value]) => ({
    id: key,
    constituinte: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    ...value
  }));

  const filtered = limitsArray.filter(item => {
    const matchesSearch = item.constituinte.toLowerCase().includes(search.toLowerCase());
    const status = item.auth ? "AUTORIZADO" : "NAO_AUTORIZADO";
    const matchesFilter = filter === "all" || status === filter;
    return matchesSearch && matchesFilter;
  });

  const POWER_BI_URL = "https://app.powerbi.com/view?r=eyJrIjoiM2M3NjkzYmMtODY0ZS00YzYzLTlhNGItM2M2NGNjZjk2YjlhIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZG";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="AUTORIZADO">Autorizados</SelectItem>
              <SelectItem value="NAO_AUTORIZADO">Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => window.open(POWER_BI_URL, '_blank')}>
          <ExternalLink className="w-4 h-4 mr-2" /> ANVISA Power BI
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const status = item.auth ? "AUTORIZADO" : "NAO_AUTORIZADO";
          return (
            <Card key={item.id} className={`overflow-hidden border-l-4 ${
              item.auth ? 'border-l-green-500 bg-green-950/10' : 'border-l-red-500 bg-red-950/10'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{item.constituinte}</CardTitle>
                  <Badge variant={item.auth ? 'default' : 'destructive'} className="text-[10px]">
                    {item.auth ? '✔ Autorizado' : '✖ Bloqueado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                {item.max !== null && <p><span className="font-bold">Limite Máx:</span> {item.max} {item.unit}</p>}
                {item.min > 0 && <p><span className="font-bold">Limite Mín:</span> {item.min} {item.unit}</p>}
                <p className="text-muted-foreground italic"><span className="font-bold not-italic">Ref:</span> {item.norm}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
