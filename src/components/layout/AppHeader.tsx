import { Moon, Sun, Menu, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { FACTORY_ROLES } from "@/hooks/use-users";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function AppHeader() {
  const [isDark, setIsDark] = useState(false);
  const { profile, role, isAuthenticated, signOut } = useAuth();

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-9 w-9">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-muted-foreground h-9 px-3"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">Buscar...</span>
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Ctrl+K
          </kbd>
        </Button>

        {isAuthenticated && <NotificationBell />}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDark(!isDark)}
          className="h-9 w-9"
          aria-label={isDark ? "Modo claro" : "Modo escuro"}
        >
          {isDark ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {isAuthenticated && profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.nome_completo} />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(profile.nome_completo)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium leading-none">{profile.nome_completo}</p>
                  <p className="text-xs text-muted-foreground">
                    {role ? FACTORY_ROLES[role]?.label : 'Usuário'}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile.nome_completo}</p>
                  <p className="text-xs text-muted-foreground">{profile.cargo || 'Sem cargo'}</p>
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
