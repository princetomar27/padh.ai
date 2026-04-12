"use client";

import {
  SidebarContent,
  SidebarMenuItem,
  SidebarMenu,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { BookOpenIcon, GraduationCapIcon, HomeIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const studentNavigationItems = [
  {
    icon: HomeIcon,
    label: "Home",
    href: "/dashboard",
  },
  {
    icon: BookOpenIcon,
    label: "Subjects",
    href: "/learn/subjects",
  },
  {
    icon: GraduationCapIcon,
    label: "Study materials",
    href: "/study-materials",
  },
];

export const StudentDashboardSidebar = () => {
  const pathName = usePathname();

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {studentNavigationItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    " h-10 hover:bg-linear-to-r/oklch border border-transparent hover:cursor-pointer hover:border-[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/10 to-sidebar/50",
                    (item.href === "/dashboard"
                      ? pathName === "/dashboard"
                      : pathName === item.href ||
                        pathName.startsWith(`${item.href}/`)) &&
                      "bg-linear-to-r/oklch border-[#5D6B68]/10 via-30% via-sidebar/30 to-sidebar/50"
                  )}
                  isActive={
                    item.href === "/dashboard"
                      ? pathName === "/dashboard"
                      : pathName === item.href ||
                        pathName.startsWith(`${item.href}/`)
                  }
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

      <div className="px-4 py-2">
        <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
      </div>
    </SidebarContent>
  );
};
