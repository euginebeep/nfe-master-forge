import { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionBlocker } from "@/components/subscription/SubscriptionBlocker";
import { CompanyRequiredGuard } from "@/components/auth/CompanyRequiredGuard";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SidebarProvider } from "@/components/ui/sidebar";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useRealtimeNotifications();
  const { isBlocked, isLoading: subLoading } = useSubscription();

  if (isBlocked && !subLoading) {
    return <SubscriptionBlocker />;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <AppHeader />
          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto"
          >
            <CompanyRequiredGuard>
              <Outlet />
            </CompanyRequiredGuard>
          </motion.main>
        </div>
      </div>
    </SidebarProvider>
  );
}
