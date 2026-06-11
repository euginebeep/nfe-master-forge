import brainxLogo from "@/assets/brainx-logo.png";
import brainxLogoDemo from "@/assets/brainx-logo.png"; // Placeholder
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface LogoDemoERPProps {
  className?: string;
  isHeader?: boolean;
}

export function LogoDemoERP({ className, isHeader = false }: LogoDemoERPProps) {
  const { profile } = useAuthContext();
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
