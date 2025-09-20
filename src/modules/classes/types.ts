import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";

export type ClassesGetMany =
  inferRouterOutputs<AppRouter>["classes"]["getMany"]["items"];

export type ClassGetOne = inferRouterOutputs<AppRouter>["classes"]["getOne"];

export interface ClassWithStats {
  id: string;
  name: string;
  number: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  studentCount: number;
  subjectCount: number;
  bookCount: number;
}

export interface ClassAnalytics {
  totalStudents: number;
  activeStudents: number;
  totalSubjects: number;
  totalBooks: number;
  averageProgress: number;
  completionRate: number;
}

export enum ClassLevel {
  PRIMARY = "PRIMARY", // Classes 1-5
  UPPER_PRIMARY = "UPPER_PRIMARY", // Classes 6-8
  SECONDARY = "SECONDARY", // Classes 9-10
  HIGHER_SECONDARY = "HIGHER_SECONDARY", // Classes 11-12
}

export const getClassLevel = (classNumber: number): ClassLevel => {
  if (classNumber >= 1 && classNumber <= 5) return ClassLevel.PRIMARY;
  if (classNumber >= 6 && classNumber <= 8) return ClassLevel.UPPER_PRIMARY;
  if (classNumber >= 9 && classNumber <= 10) return ClassLevel.SECONDARY;
  if (classNumber >= 11 && classNumber <= 12)
    return ClassLevel.HIGHER_SECONDARY;
  return ClassLevel.PRIMARY; // Default fallback
};

export const getClassDescription = (classNumber: number): string => {
  const level = getClassLevel(classNumber);
  switch (level) {
    case ClassLevel.PRIMARY:
      return "Primary Education";
    case ClassLevel.UPPER_PRIMARY:
      return "Upper Primary Education";
    case ClassLevel.SECONDARY:
      return "Secondary Education";
    case ClassLevel.HIGHER_SECONDARY:
      return classNumber === 11
        ? "Higher Secondary - Science Stream"
        : "Senior Secondary - Science Stream";
    default:
      return "Education";
  }
};
