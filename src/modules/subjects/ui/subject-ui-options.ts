/** Lucide icon names stored in `subjects.icon` — keep in sync with `subject-icon.tsx`. */
export const SUBJECT_ICON_OPTIONS = [
  { value: "atom", label: "Physics (Atom)" },
  { value: "calculator", label: "Mathematics (Calculator)" },
  { value: "flask-conical", label: "Chemistry (Flask)" },
  { value: "beaker", label: "Chemistry (Beaker)" },
  { value: "globe-2", label: "Biology (Globe)" },
  { value: "pen-line", label: "English (Pen)" },
  { value: "languages", label: "Hindi (Languages)" },
  { value: "book-open", label: "Default (Book)" },
] as const;

export const SUBJECT_COLOR_OPTIONS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#ec4899", label: "Pink" },
  { value: "#22c55e", label: "Green" },
  { value: "#f97316", label: "Orange" },
  { value: "#6366f1", label: "Indigo" },
] as const;

export const DEFAULT_SUBJECT_ICON = "book-open";
export const DEFAULT_SUBJECT_COLOR = "#3b82f6";
