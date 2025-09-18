"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  Users,
  Settings,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant: "primary" | "secondary" | "success" | "warning";
}

const getVariantStyles = (variant: QuickAction["variant"]) => {
  switch (variant) {
    case "primary":
      return {
        bg: "bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/30",
        icon: "text-purple-600 dark:text-purple-400",
        button: "hover:bg-purple-50 dark:hover:bg-purple-900/40",
      };
    case "secondary":
      return {
        bg: "bg-pink-100 hover:bg-pink-200 dark:bg-pink-900/20 dark:hover:bg-pink-900/30",
        icon: "text-pink-600 dark:text-pink-400",
        button: "hover:bg-pink-50 dark:hover:bg-pink-900/40",
      };
    case "success":
      return {
        bg: "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30",
        icon: "text-emerald-600 dark:text-emerald-400",
        button: "hover:bg-emerald-50 dark:hover:bg-emerald-900/40",
      };
    case "warning":
      return {
        bg: "bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/30",
        icon: "text-orange-600 dark:text-orange-400",
        button: "hover:bg-orange-50 dark:hover:bg-orange-900/40",
      };
  }
};

const QuickActionItem = ({ action }: { action: QuickAction }) => {
  const styles = getVariantStyles(action.variant);

  const content = (
    <div
      className={cn(
        "group relative flex items-start space-x-4 p-4 rounded-lg border border-transparent transition-all duration-200 cursor-pointer",
        styles.bg
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-gray-800 shadow-sm",
          styles.icon
        )}
      >
        {action.icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{action.title}</h4>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <p className="text-xs text-muted-foreground">{action.description}</p>
      </div>
    </div>
  );

  if (action.href) {
    return (
      <Link href={action.href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={action.onClick} className="block w-full text-left">
      {content}
    </button>
  );
};

export const QuickActions = () => {
  const quickActions: QuickAction[] = [
    {
      id: "upload-book",
      title: "Upload New Book",
      description: "Add NCERT textbooks to the system",
      icon: <BookOpen className="h-5 w-5" />,
      href: "/admin/content/books/new",
      variant: "primary",
    },
    {
      id: "create-test",
      title: "Create Test",
      description: "Build new assessments for students",
      icon: <FileText className="h-5 w-5" />,
      href: "/admin/content/tests/new",
      variant: "secondary",
    },
    {
      id: "manage-users",
      title: "Manage Users",
      description: "Add or modify user accounts",
      icon: <Users className="h-5 w-5" />,
      href: "/admin/users",
      variant: "success",
    },
    {
      id: "configure-ai",
      title: "Configure AI Tutor",
      description: "Set up AI teaching assistants",
      icon: <Settings className="h-5 w-5" />,
      href: "/admin/ai-tutors",
      variant: "warning",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <Plus className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Common tasks and shortcuts
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 md:grid-cols-2">
          {quickActions.map((action) => (
            <QuickActionItem key={action.id} action={action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
