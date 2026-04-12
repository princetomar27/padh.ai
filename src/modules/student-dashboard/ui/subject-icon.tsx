"use client";

import { BookOpen } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

function toPascalCase(raw: string) {
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

export function SubjectIcon({
  iconName,
  className,
}: {
  iconName: string | null;
  className?: string;
}) {
  if (!iconName?.trim()) {
    return <BookOpen className={className} aria-hidden />;
  }
  const key = toPascalCase(iconName.trim()) as keyof typeof LucideIcons;
  const Comp = LucideIcons[key] as LucideIcon | undefined;
  if (Comp && typeof Comp === "function") {
    return <Comp className={className} aria-hidden />;
  }
  return <BookOpen className={className} aria-hidden />;
}
