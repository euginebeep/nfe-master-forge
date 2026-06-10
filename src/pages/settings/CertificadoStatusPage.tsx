import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CertificadoStatusCard } from "@/components/fiscal/CertificadoStatusCard";

export default function CertificadoStatusPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Status do Certificado A1"
        description="Validação do certificado digital, ambiente e numeração fiscal antes da emissão"
        icon={ShieldCheck}
        actions={
          <Button variant="outline" onClick={() => navigate("/settings/empresa")}>
            Abrir configurações da empresa
          </Button>
        }
      />
      <CertificadoStatusCard />
    </div>
  );
}