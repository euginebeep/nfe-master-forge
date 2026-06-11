import brainxLogo from "@/assets/brainx-logo.png";
import brainxLogoDemo from "@/assets/brainx-logo.png"; // Placeholder
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface LogoDemoERPProps {
  className?: string;
}

export function LogoDemoERP({ className }: LogoDemoERPProps) {
  const { profile, isAuthenticated, isLoading } = useAuthContext();
  
  // Se ainda estiver carregando a autenticação, não mostramos nada para evitar flicker do logo demo
  if (isLoading) return <div className={cn("bg-muted animate-pulse rounded", className)} />;

  // Se não estiver autenticado, mostramos o logo oficial (landing page / login)
  if (!isAuthenticated) {
    return (
      <img
        src={brainxLogo}
        alt="BrainX ERP"
        className={cn("object-contain rounded shrink-0", className)}
        loading="lazy"
      />
    );
  }

  const isDemo = profile?.is_demo;

  return (
    <img
      src={isDemo ? brainxLogoDemo : brainxLogo}
      alt={isDemo ? "BrainX Demo" : "BrainX ERP"}
      className={cn(
        "object-contain rounded shrink-0 transition-all duration-200",
        className
      )}
      loading="lazy"
    />
  );
}
