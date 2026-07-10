import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { useSubscription } from "@/hooks/use-subscription";
import { useNavigationAudit } from "@/hooks/use-navigation-audit";
import { SubscriptionBlocker } from "@/components/subscription/SubscriptionBlocker";
import { useAuthContext } from "@/contexts/AuthContext";
import { CompanyRequiredGuard } from "@/components/auth/CompanyRequiredGuard";
import { ChatGlobalProvider } from "@/components/chat/ChatGlobalProvider";
import { AssistenteProvider } from "@/components/assistente/BrainXAssistente";
import { OnboardingWalkthrough } from "@/components/onboarding/OnboardingWalkthrough";
import { BannerContextual } from "@/components/ajuda/BannerContextual";
import { CompanyPendingBanner } from "./CompanyPendingBanner";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { UnlockBanner } from "@/components/security/UnlockBanner";

export function MainLayout() {
  useRealtimeNotifications();
  useNavigationAudit();
  const { isBlocked, isLoading: subLoading } = useSubscription();
  const { role } = useAuthContext();

  // saas_owner e saas_suporte nunca são bloqueados pela tela de assinatura
  const isSaasStaff = role === 'saas_owner' || role === 'saas_suporte';

  if (isBlocked && !subLoading && !isSaasStaff) {
    return <SubscriptionBlocker />;
  }

  return (
    <AssistenteProvider>
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <UnlockBanner />
          <DemoModeBanner />
          <AppHeader />
          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0 p-1 sm:p-2 md:p-4 lg:p-6 overflow-auto"
          >
            <div className="w-full max-w-7xl mx-auto px-1 sm:px-2 md:px-4">
              <CompanyRequiredGuard>
                <CompanyPendingBanner />
                <BannerContextual />
                <Outlet />
              </CompanyRequiredGuard>
            </div>
          </motion.main>
        </div>
        <ChatGlobalProvider />
        <OnboardingWalkthrough />
      </div>
    </SidebarProvider>
    </AssistenteProvider>
  );
}
