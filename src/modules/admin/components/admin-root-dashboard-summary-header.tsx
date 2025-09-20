"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Users,
  BookOpen,
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { AdminDashboardSummary } from "../types";

interface AdminRootDashboardSummaryHeaderProps {
  summary: AdminDashboardSummary | null;
}

interface StatCardProps {
  title: string;
  value: string | number;
  growth: number;
  growthLabel: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
}

const StatCard = ({
  title,
  value,
  growth,
  growthLabel,
  icon,
  iconBgColor,
  iconColor,
}: StatCardProps) => {
  const isPositiveGrowth = growth >= 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
            <div className="flex items-center gap-2">
              <Badge
                variant={isPositiveGrowth ? "default" : "destructive"}
                className="flex items-center gap-1 px-2 py-1"
              >
                {isPositiveGrowth ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(growth)}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {growthLabel}
              </span>
            </div>
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              iconBgColor
            )}
          >
            <div className={cn("h-6 w-6", iconColor)}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {[1, 2, 3, 4].map((i) => (
      <Card key={i} className="animate-pulse">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-12 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            </div>
            <div className="h-12 w-12 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const AdminRootDashboardSummaryHeader = ({
  summary,
}: AdminRootDashboardSummaryHeaderProps) => {
  if (!summary) {
    return <LoadingSkeleton />;
  }

  const stats = [
    {
      title: "Total Students",
      value: summary.totalStudents,
      growth: summary.studentsGrowth,
      growthLabel: "Active learners this month",
      icon: <Users className="h-6 w-6" />,
      iconBgColor: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Active Books",
      value: summary.activeBooks,
      growth: summary.booksGrowth,
      growthLabel: "NCERT books uploaded",
      icon: <BookOpen className="h-6 w-6" />,
      iconBgColor: "bg-emerald-100 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Learning Sessions",
      value: summary.learningSessions,
      growth: summary.sessionsGrowth,
      growthLabel: "AI tutor interactions",
      icon: <MessageSquare className="h-6 w-6" />,
      iconBgColor: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Tests Completed",
      value: summary.testsCompleted,
      growth: summary.testsGrowth,
      growthLabel: "Assessments taken",
      icon: <FileText className="h-6 w-6" />,
      iconBgColor: "bg-pink-100 dark:bg-pink-900/20",
      iconColor: "text-pink-600 dark:text-pink-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};
