import { Moon, Sun, Menu, LogOut, Search, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import brainxWordmark from "@/assets/brainx-wordmark.png";
import brainxWordmark2x from "@/assets/brainx-wordmark@2x.png";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { FACTORY_ROLES } from "@/hooks/use-users";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AssistenteTrigger } from "@/components/assistente/BrainXAssistente";
import { AlertasLoteSemCOAPanel } from "@/components/estoque/AlertasLoteSemCOAPanel";
import { useCompany } from "@/hooks/use-company";
import { useCompanyBranding } from "@/hooks/use-company-branding";
import { formatCNPJ } from "@/lib/cnpj-lookup";
import { cn } from "@/lib/utils";

function maskCNPJ(cnpj?: string | null) {
  if (!cnpj) return "";
  const formatted = formatCNPJ(cnpj);
  return formatted.replace(/^(\d{2})\.\d{3}\.\d{3}/, "$1.***.***");
}

export function AppHeader() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("brainx-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const { profile, role, isAuthenticated, signOut } = useAuth();
  const { data: company } = useCompany();
  const { data: branding } = useCompanyBranding();

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("brainx-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("brainx-theme", "light");
    }
  }, [isDark]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const companyName =
    branding?.nome_fantasia ||
    branding?.razao_social ||
    company?.nome_fantasia ||
    company?.razao_social;
  const companyCnpj = branding?.cnpj || company?.cnpj;
  const companyLogo = branding?.logo_url;

  return (
    <header className="h-20 sm:h-24 border-b bg-card flex items-center justify-between px-2 sm:px-4 shrink-0 gap-1 sm:gap-2">
      <div className="flex items-center gap-1 sm:gap-2">
        <SidebarTrigger className="h-8 sm:h-9 w-8 sm:w-9" aria-label="Abrir/fechar menu lateral">
          <Menu className="h-4 sm:h-5 w-4 sm:w-5" />
        </SidebarTrigger>
        <Link to="/dashboard" className="flex items-center shrink-0" aria-label="BrainX ERP">
          <img
            src={brainxWordmark}
            srcSet={`${brainxWordmark} 1x, ${brainxWordmark2x} 2x`}
            alt="BrainX ERP"
            className="h-5 sm:h-6 w-auto object-contain"
          />
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden h-8 w-8"
          aria-label="Buscar"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-1 md:gap-2 text-muted-foreground h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
          aria-label="Busca global (Ctrl+K)"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
        >
          <Search className="h-3 sm:h-4 w-3 sm:w-4" />
          <span className="hidden md:inline">Buscar...</span>
          <kbd className="ml-1 md:ml-2 pointer-events-none hidden lg:inline-flex h-4 sm:h-5 select-none items-center gap-1 rounded border bg-muted px-1 sm:px-1.5 font-mono text-[9px] sm:text-[10px] font-medium text-muted-foreground">
            Ctrl+K
          </kbd>
        </Button>

        {isAuthenticated && <NotificationBell />}
        {isAuthenticated && <AssistenteTrigger />}
        {isAuthenticated && <AlertasLoteSemCOAPanel />}

        {isAuthenticated && company && (
          <div
            className="hidden lg:flex items-center gap-2 px-2 sm:px-2.5 py-1 rounded-md border bg-muted/50 max-w-[220px] lg:max-w-[280px]"
            title={`${company.razao_social} — CNPJ ${formatCNPJ(company.cnpj || "")}`}
          >
            {companyLogo ? (
              <img
                src={companyLogo}
                alt=""
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-md object-contain bg-background border border-border/60 shrink-0"
              />
            ) : (
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
            )}
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold truncate">
                {companyName}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                Matriz · {maskCNPJ(companyCnpj)}
              </span>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDark(!isDark)}
          className="h-8 sm:h-9 w-8 sm:w-9"
          aria-label={isDark ? "Modo claro" : "Modo escuro"}
        >
          {isDark ? (
            <Sun className="h-4 sm:h-5 w-4 sm:w-5" />
          ) : (
            <Moon className="h-4 sm:h-5 w-4 sm:w-5" />
          )}
        </Button>

        {isAuthenticated && profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2">
                <Avatar className="h-[4.5rem] sm:h-20 w-[4.5rem] sm:w-20 border-2 border-primary/30 shadow-sm">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.nome_completo} />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-base sm:text-lg font-semibold">
                      {getInitials(profile.nome_completo)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="text-left hidden sm:block">
                  <p
                    className={cn(
                      "text-xs sm:text-sm font-bold leading-none",
                      profile.sexo === "FEMININO"
                        ? "text-pink-600 dark:text-pink-400"
                        : "text-blue-600 dark:text-blue-400",
                    )}
                  >
                    {profile.nome_completo}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {role ? FACTORY_ROLES[role]?.label : "Usuário"}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      profile.sexo === "FEMININO"
                        ? "text-pink-600 dark:text-pink-400"
                        : "text-blue-600 dark:text-blue-400",
                    )}
                  >
                    {profile.nome_completo}
                  </p>
                  <p className="text-xs text-muted-foreground">{profile.cargo || "Sem cargo"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">?</span>
            </div>
            <span className="text-sm font-medium">Visitante</span>
          </div>
        )}
      </div>
    </header>
  );
}
