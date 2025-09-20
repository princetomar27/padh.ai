"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BookOpen, Users, FileText, Settings, Activity } from "lucide-react";
import { RecentActivityItem } from "../types";
import { formatDistanceToNow } from "date-fns";

interface RecentActivityProps {
  activities: RecentActivityItem[];
}

const getActivityIcon = (type: RecentActivityItem["type"]) => {
  switch (type) {
    case "book_upload":
      return <BookOpen className="h-4 w-4" />;
    case "student_joined":
      return <Users className="h-4 w-4" />;
    case "parent_joined":
      return <Users className="h-4 w-4" />;
    case "teacher_joined":
      return <Users className="h-4 w-4" />;
    case "test_created":
      return <FileText className="h-4 w-4" />;
    case "ai_tutor_updated":
      return <Settings className="h-4 w-4" />;
    case "chapter_processed":
      return <Activity className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getActivityColor = (type: RecentActivityItem["type"]) => {
  switch (type) {
    case "book_upload":
      return "bg-emerald-500";
    case "student_joined":
      return "bg-blue-500";
    case "parent_joined":
      return "bg-yellow-500";
    case "teacher_joined":
      return "bg-pink-500";
    case "test_created":
      return "bg-purple-500";
    case "ai_tutor_updated":
      return "bg-orange-500";
    case "chapter_processed":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

const getBadgeColor = (type: RecentActivityItem["type"]) => {
  switch (type) {
    case "book_upload":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "student_joined":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "parent_joined":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "teacher_joined":
      return "bg-pink-100 text-pink-800 hover:bg-pink-100";
    case "test_created":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    case "ai_tutor_updated":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    case "chapter_processed":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

const getBadgeText = (type: RecentActivityItem["type"]) => {
  switch (type) {
    case "book_upload":
      return "Content Manager";
    case "student_joined":
      return "System";
    case "parent_joined":
      return "Parent";
    case "teacher_joined":
      return "Teacher";
    case "test_created":
      return "Teacher Admin";
    case "ai_tutor_updated":
      return "AI Manager";
    case "chapter_processed":
      return "System";
    default:
      return "System";
  }
};

const ActivityItem = ({ activity }: { activity: RecentActivityItem }) => {
  const icon = getActivityIcon(activity.type);
  const color = getActivityColor(activity.type);
  const badgeColor = getBadgeColor(activity.type);
  const badgeText = getBadgeText(activity.type);

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-white",
          color
        )}
      >
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium leading-none">{activity.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{activity.description}</p>
        <Badge variant="secondary" className={cn("text-xs", badgeColor)}>
          {badgeText}
        </Badge>
      </div>
    </div>
  );
};

export const RecentActivity = ({ activities }: RecentActivityProps) => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Latest updates and changes in your system
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
