"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Atom,
  Beaker,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe2,
  Languages,
  PenLine,
} from "lucide-react";
import { DEFAULT_SUBJECT_ICON } from "./subject-ui-options";

const MAP: Record<string, LucideIcon> = {
  atom: Atom,
  calculator: Calculator,
  "flask-conical": FlaskConical,
  beaker: Beaker,
  "globe-2": Globe2,
  globe: Globe2,
  "pen-line": PenLine,
  languages: Languages,
  book: BookOpen,
  "book-open": BookOpen,
};

type SubjectIconProps = {
  name?: string | null;
  className?: string;
};

export function SubjectIcon({ name, className }: SubjectIconProps) {
  const key = (name?.trim() || DEFAULT_SUBJECT_ICON).toLowerCase();
  const Icon = MAP[key] ?? BookOpen;
  return <Icon className={cn("shrink-0", className)} />;
}
