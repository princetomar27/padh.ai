"use client";

import {
  SidebarContent,
  SidebarMenuItem,
  SidebarMenu,
  SidebarGroup,
  SidebarGroupContent,
  SidebarSeparator,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  BotIcon,
  VideoIcon,
  UsersIcon,
  SchoolIcon,
  BookOpenIcon,
  SettingsIcon,
  BarChart3Icon,
  ShieldIcon,
  UserCheckIcon,
} from "lucide-react";
import {
  FaBook,
  FaBookOpen,
  FaFile,
  FaFileInvoice,
  FaSchool,
} from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface NavigationItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  isGroup?: boolean;
  children?: NavigationItem[];
}

const adminNavigationItems: NavigationItem[] = [
  {
    icon: FaFile,
    label: "Content Management",
    isGroup: true,
    children: [
      {
        icon: FaSchool,
        label: "Classes",
        href: "/classes",
      },
      {
        icon: FaBookOpen,
        label: "Subjects",
        href: "/subjects",
      },
      {
        icon: FaBook,
        label: "Books",
        href: "/books",
      },
      {
        icon: FaFileInvoice,
        label: "Chapters",
        href: "/chapters",
      },
      {
        icon: SchoolIcon,
        label: "Schools",
        href: "/schools",
      },
    ],
  },
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
  {
    icon: UsersIcon,
    label: "Users",
    href: "/users",
  },

  {
    icon: BookOpenIcon,
    label: "Curriculum",
    href: "/curriculum",
  },
  {
    icon: BarChart3Icon,
    label: "Analytics",
    href: "/analytics",
  },
  {
    icon: SettingsIcon,
    label: "Settings",
    href: "/admin/settings",
  },
];

const adminSecondaryItems = [
  {
    icon: ShieldIcon,
    label: "Admin Panel",
    href: "/admin",
  },
  {
    icon: UserCheckIcon,
    label: "User Management",
    href: "/admin/users",
  },
];

export const AdminDashboardSidebar = () => {
  const pathName = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Content Management": true, // Default to open
  });

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  const renderMenuItem = (item: NavigationItem) => {
    if (item.isGroup && item.children) {
      const isOpen = openGroups[item.label] || false;

      return (
        <SidebarMenuItem key={item.label}>
          <Collapsible
            open={isOpen}
            onOpenChange={() => toggleGroup(item.label)}
          >
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className={cn(
                  "h-10 hover:bg-linear-to-r/oklch border border-transparent hover:cursor-pointer hover:border-[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/10 to-sidebar/50"
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  <item.icon className="size-5" />
                  <span className="text-sm font-medium tracking-tight">
                    {item.label}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronDownIcon className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.children.map((child: NavigationItem) => (
                  <SidebarMenuSubItem key={child.label}>
                    <SidebarMenuSubButton
                      asChild
                      className={cn(
                        "h-8 hover:bg-linear-to-r/oklch border border-transparent hover:cursor-pointer hover:border-[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/10 to-sidebar/50",
                        pathName === child.href &&
                          "bg-linear-to-r/oklch border-[#5D6B68]/10 via-30% via-sidebar/30 to-sidebar/50"
                      )}
                      isActive={pathName === child.href}
                    >
                      <Link
                        href={child.href!}
                        className={cn("group flex items-center gap-2 ")}
                      >
                        <child.icon className="size-4" />
                        <span className="text-sm font-medium tracking-tight">
                          {child.label}
                        </span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenuItem>
      );
    }

    // Regular menu item
    return (
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
            href={item.href!}
            className={cn("group flex items-center gap-2 ")}
          >
            <item.icon className="size-5" />
            <span className="text-sm font-medium tracking-tight">
              {item.label}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {adminNavigationItems.map((item) => renderMenuItem(item))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <div className="px-4 py-2">
        <SidebarSeparator className="opacity-100 text-[#5D6B68]" />
      </div>

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {adminSecondaryItems.map((item) => (
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
