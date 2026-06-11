import brainxLogo from "@/assets/brainx-logo.png";
import brainxLogoDemo from "@/assets/brainx-logo.png"; // Placeholder
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface LogoDemoERPProps {
  className?: string;
  style?: React.CSSProperties;
}

export function LogoDemoERP({ className, style }: LogoDemoERPProps) {
  const { profile, isAuthenticated, isLoading } = useAuthContext();
  
  // Se ainda estiver carregando a autenticação, mostramos um placeholder animado
  // para evitar o flicker do logo demo antes de saber se o usuário é real ou não.
  if (isLoading) return <div className={cn("bg-muted animate-pulse rounded", className)} style={style} />;

  // Se não estiver autenticado (landing page/login), usamos o oficial.
  // Se for demo_mode via sessionStorage (mesmo sem profile carregado), usamos o demo.
  const isDemoSession = sessionStorage.getItem('brainx_demo_mode') === 'true';
  const isDemo = isDemoSession || profile?.is_demo;

  return (
    <img
      src={isDemo ? brainxLogoDemo : brainxLogo}
      alt={isDemo ? "BrainX Demo" : "BrainX ERP"}
      className={cn(
        "object-contain rounded shrink-0 transition-all duration-200 scale-[1.4]",
        className
      )}
      style={style}
      loading="lazy"
    />
  );
}
