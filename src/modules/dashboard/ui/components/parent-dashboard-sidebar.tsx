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
import {
  BotIcon,
  VideoIcon,
  UsersIcon,
  BookOpenIcon,
  BarChart3Icon,
  HeartIcon,
  MessageCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const parentNavigationItems = [
  {
    icon: UsersIcon,
    label: "My Children",
    href: "/children",
  },
  {
    icon: VideoIcon,
    label: "Meetings",
    href: "/meetings",
  },
  {
    icon: BotIcon,
    label: "AI Agents",
    href: "/agents",
  },
  {
    icon: BookOpenIcon,
    label: "Progress Reports",
    href: "/progress-reports",
  },
  {
    icon: BarChart3Icon,
    label: "Analytics",
    href: "/analytics",
  },
  {
    icon: MessageCircleIcon,
    label: "Communication",
    href: "/communication",
  },
];

const parentSecondaryItems = [
  {
    icon: HeartIcon,
    label: "Parent Resources",
    href: "/parent-resources",
  },
];

export const ParentDashboardSidebar = () => {
  const pathName = usePathname();

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {parentNavigationItems.map((item) => (
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

      <div className="px-4 py-2">
        <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
      </div>

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {parentSecondaryItems.map((item) => (
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
    </SidebarContent>
  );
};
