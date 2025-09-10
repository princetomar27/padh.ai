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
import { BotIcon, StarIcon, VideoIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardUserButton from "./dashboard-user-button";
import { DashboardTrial } from "./dashboard-trial";

const firstSection = [
  {
    icon: VideoIcon,
    label: "Meetings",
    href: "/meetings",
  },
  {
    icon: BotIcon,
    label: "Agents",
    href: "/agents",
  },
];

const secondSection = [
  {
    icon: StarIcon,
    label: "Upgrade",
    href: "/upgrade",
  },
];

export const DashboardSidebar = () => {
  const pathName = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link href="/" className="flex items-center gap-2 px-2 pt-2">
          <Image alt="Samvaad.AI" height={36} width={36} src="/logo.svg" />{" "}
          <p className="text-2xl font-semibold">Samvaad.AI</p>
        </Link>
      </SidebarHeader>
      <div className="px-4 py-2">
        <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {firstSection.map((item) => (
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
              {secondSection.map((item) => (
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
      <SidebarFooter className=" ">
        <div className="p-2 gap-y-2 flex flex-col">
          <DashboardTrial />
          <DashboardUserButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
