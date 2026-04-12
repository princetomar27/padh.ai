import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardNavbar from "@/modules/dashboard/ui/components/dashboard-navbar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import React from "react";

// Dashboard pages require Clerk auth — disable static prerendering so Next.js
// never tries to fetch tRPC/user data without a live server.
export const dynamic = "force-dynamic";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <main className="flex h-screen min-h-0 w-screen flex-col bg-muted">
        <DashboardNavbar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
    </SidebarProvider>
  );
};

export default Layout;
