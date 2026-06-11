import { QRCodeSVG } from 'qrcode.react';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, Shield } from 'lucide-react';

type TipoQR = 'LOTE_MP' | 'OP' | 'PRODUTO_ACABADO' | 'FORMULA';

interface QRCodeAuditoriaProps {
  tipo: TipoQR;
  id: string;
  hash: string;
  codigo?: string;
  label?: string;
  size?: number;
  showCard?: boolean;
}

function getAuditUrl(tipo: TipoQR, id: string, hash: string): string {
  // Use a custom domain if available, otherwise use published URL
  const baseUrl = "https://www.brainxerp.com";
  switch (tipo) {
    case 'LOTE_MP':
      return `${baseUrl}/audit/lote/${hash}`;
    case 'OP':
      return `${baseUrl}/op/verify/${id}`;
    case 'PRODUTO_ACABADO':
      return `${baseUrl}/audit/lote/${hash}`;
    case 'FORMULA':
      return `${baseUrl}/audit/formula/${hash}`;
    default:
      return `${baseUrl}/audit/${hash}`;
  }
}

const tipoLabels: Record<TipoQR, string> = {
  LOTE_MP: 'Lote MP',
  OP: 'Ordem de Produção',
  PRODUTO_ACABADO: 'Produto Acabado',
  FORMULA: 'Fórmula',
};

export function QRCodeAuditoria({
  tipo,
  id,
  hash,
  codigo,
  label,
  size = 128,
  showCard = true,
}: QRCodeAuditoriaProps) {
  const { profile } = useAuthContext();
  const url = getAuditUrl(tipo, id, hash, profile?.company_id);

  const qrData = JSON.stringify({
    tipo,
    id,
    hash: hash.slice(0, 16),
    url,
    ts: new Date().toISOString(),
  });

  const qrContent = (
    <div className="flex flex-col items-center gap-2">
      <QRCodeSVG
        value={url}
        size={size}
        level="H"
        includeMargin
        className="rounded"
      />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Shield className="h-3 w-3" />
        <span>SHA-256 verificável</span>
      </div>
      {codigo && (
        <Badge variant="outline" className="text-xs">
          {codigo}
        </Badge>
      )}
    </div>
  );

  if (!showCard) return qrContent;

  return (
    <Card className="w-fit">
      <CardContent className="p-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <QrCode className="h-4 w-4 text-primary" />
          <span>{label || tipoLabels[tipo]}</span>
        </div>
        {qrContent}
        <p className="text-[10px] text-muted-foreground font-mono max-w-[150px] truncate">
          {hash.slice(0, 24)}...
        </p>
      </CardContent>
    </Card>
  );
}
