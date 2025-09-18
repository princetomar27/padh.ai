"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenuItem,
  SidebarMenu,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardUserButton from "./dashboard-user-button";
import { DashboardTrial } from "./dashboard-trial";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { StudentDashboardSidebar } from "./student-dashboard-sidebar";
import { TeacherDashboardSidebar } from "./teacher-dashboard-sidebar";
import { AdminDashboardSidebar } from "./admin-dashboard-sidebar";
import { ParentDashboardSidebar } from "./parent-dashboard-sidebar";

const upgradeSection = [
  {
    icon: StarIcon,
    label: "Upgrade",
    href: "/upgrade",
  },
];

export const DashboardSidebar = () => {
  const pathName = usePathname();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const trpc = useTRPC();

  const { data: currentUser } = useSuspenseQuery(
    trpc.auth.getCurrentUser.queryOptions()
  );

  const isPending = isSessionPending;

  // Show loading state while session is loading
  if (isPending || !session?.user) {
    return (
      <Sidebar>
        <SidebarHeader className="text-sidebar-accent-foreground">
          <Link href="/" className="flex items-center gap-2 px-2 pt-2">
            <Image alt="padh.AI" height={36} width={36} src="/padhai.svg" />{" "}
            <p className="text-2xl font-semibold">padh.ai</p>
          </Link>
        </SidebarHeader>
        <div className="px-4 py-2">
          <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
        </div>
        <SidebarContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </SidebarContent>
        <SidebarFooter className=" ">
          <div className="p-2 gap-y-2 flex flex-col">
            <DashboardTrial />
            <DashboardUserButton />
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  // Get user role from currentUser
  const userRole = currentUser.role;

  // Render role-specific sidebar content
  const renderRoleBasedSidebar = () => {
    switch (userRole) {
      case "STUDENT":
        return <StudentDashboardSidebar />;
      case "TEACHER":
        return <TeacherDashboardSidebar />;
      case "ADMIN":
        return <AdminDashboardSidebar />;
      case "PARENT":
        return <ParentDashboardSidebar />;
      default:
        return <StudentDashboardSidebar />; // Default fallback
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link href="/" className="flex items-center gap-2 px-2 pt-2">
          <Image alt="padh.AI" height={36} width={36} src="/padhai.svg" />{" "}
          <p className="text-2xl font-semibold">padh.ai</p>
        </Link>
      </SidebarHeader>
      <div className="px-4 py-2">
        <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
      </div>

      {renderRoleBasedSidebar()}

      {/* Common upgrade section for all roles */}
      <div className="px-4 py-2">
        <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
      </div>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {upgradeSection.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    " h-10 hover:bg-linear-to-r/oklch border border-transparent hover:cursor-pointer hover:border-[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/10 to-sidebar/50",
                    pathName === item.href &&
                      "bg-linear-to-r/oklch border-[#5D6B68]/10 via-30% via-sidebar/30 to-sidebar/50"
                  )}
                  isActive={pathName === item.href}
                >
                  <Link
                    href={item.href}
                    className={cn("group flex items-center gap-2 ")}
                  >
                    <item.icon className="size-5" />
                    <span className="text-sm font-medium tracking-tight">
                      {item.label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarFooter className=" ">
        <div className="p-2 gap-y-2 flex flex-col">
          <DashboardTrial />
          <DashboardUserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
