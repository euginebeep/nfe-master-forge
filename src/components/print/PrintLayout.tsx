import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ } from "@/lib/formatters";

interface PrintLayoutProps {
  title: string;
  subtitle?: string;
  qrCodeValue: string;
  qrCodeLabel?: string;
  footerQrCodeValue?: string;
  footerQrCodeLabel?: string;
  children: React.ReactNode;
  showCompanyHeader?: boolean;
}

export function PrintLayout({
  title,
  subtitle,
  qrCodeValue,
  qrCodeLabel,
  footerQrCodeValue,
  footerQrCodeLabel,
  children,
  showCompanyHeader = true,
}: PrintLayoutProps) {
  const { data: company } = useQuery({
    queryKey: ["company-print"],
    queryFn: async () => {
      const { data } = await supabase.from("company").select("*").limit(1).maybeSingle();
      return data;
    },
    enabled: showCompanyHeader,
  });

  return (
    <div className="print-layout bg-white text-black p-8 max-w-[210mm] mx-auto text-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex-1">
          {showCompanyHeader && company && (
            <div className="mb-2">
              <h2 className="text-lg font-bold">{company.razao_social}</h2>
              {company.nome_fantasia && (
                <p className="text-xs text-gray-600">{company.nome_fantasia}</p>
              )}
              <p className="text-xs text-gray-600">
                CNPJ: {formatCNPJ(company.cnpj)}
                {company.ie && ` | IE: ${company.ie}`}
              </p>
              {company.endereco_logradouro && (
                <p className="text-xs text-gray-500">
                  {company.endereco_logradouro}
                  {company.endereco_nro && `, ${company.endereco_nro}`}
                  {company.endereco_bairro && ` - ${company.endereco_bairro}`}
                  {company.endereco_cidade && ` - ${company.endereco_cidade}`}
                  {company.endereco_uf && `/${company.endereco_uf}`}
                  {company.endereco_cep && ` - CEP: ${company.endereco_cep}`}
                </p>
              )}
              {(company.telefone || company.email_fiscal) && (
                <p className="text-xs text-gray-500">
                  {company.telefone && `Tel: ${company.telefone}`}
                  {company.telefone && company.email_fiscal && " | "}
                  {company.email_fiscal && `Email: ${company.email_fiscal}`}
                </p>
              )}
            </div>
          )}
          <h1 className="text-xl font-bold uppercase tracking-wide">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex flex-col items-center ml-4">
          <QRCodeSVG value={qrCodeValue} size={120} includeMargin={false} />
          {qrCodeLabel && (
            <span className="text-[9px] text-gray-500 mt-1 text-center max-w-[120px]">
              {qrCodeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="print-content">{children}</div>

      {/* Footer */}
      <div className="border-t border-gray-300 mt-8 pt-4 flex items-end justify-between text-[10px] text-gray-500">
        <div>
          <p>
            Impresso em: {new Date().toLocaleString("pt-BR")}
          </p>
          <p>BrainX - ERP Industrial</p>
        </div>
        {footerQrCodeValue && (
          <div className="flex flex-col items-center">
            <QRCodeSVG value={footerQrCodeValue} size={64} includeMargin={false} />
            {footerQrCodeLabel && (
              <span className="text-[8px] text-gray-400 mt-0.5">{footerQrCodeLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
