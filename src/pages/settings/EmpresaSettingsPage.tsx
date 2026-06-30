import { Navigate } from "react-router-dom";

// Esta página foi unificada com CompanySettingsPage (/settings/company) em
// 2026-06-30, após uma auditoria encontrar duas implementações divergentes
// da mesma tela "Configurações da Empresa":
//   - Esta (/settings/empresa) só era referenciada pelo menu lateral, e
//     misturava uma fonte de dados local (localStorage) em paralelo ao
//     Supabase, causando bugs de sincronização. Também salvava a senha do
//     certificado digital A1 em texto puro no localStorage.
//   - /settings/company já era a referenciada pelo dashboard, busca global
//     (⌘K) e pelo guard de onboarding — e usa só Supabase como fonte única.
//
// Todas as funcionalidades desta página (opt-out de parceiros, prévia de
// logo nos documentos, validação de upload de logo) foram portadas para
// CompanySettingsPage antes desta mudança. Mantemos esta rota como redirect
// — em vez de removê-la — para não quebrar links/favoritos antigos que
// apontem para /settings/empresa.
export default function EmpresaSettingsPage() {
  return <Navigate to="/settings/company" replace />;
}
