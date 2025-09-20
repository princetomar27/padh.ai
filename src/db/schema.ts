import { nanoid } from "nanoid";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  jsonb,
  AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "STUDENT",
  "PARENT",
  "TEACHER",
  "ADMIN",
]);

export const learningSessionStatus = pgEnum("learning_session_status", [
  "UPCOMING",
  "ACTIVE",
  "COMPLETED",
  "PROCESSING",
  "CANCELLED",
]);

export const testType = pgEnum("test_type", [
  "MCQ",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "MIXED",
]);

export const questionType = pgEnum("question_type", [
  "MCQ",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "TRUE_FALSE",
  "FILL_IN_BLANK",
]);

export const difficultyLevel = pgEnum("difficulty_level", [
  "EASY",
  "MEDIUM",
  "HARD",
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  role: userRole("role").notNull().default("STUDENT"),
  // Educational fields
  class: integer("class"), // 1-12 for CBSE
  school: text("school"),
  parentId: text("parent_id").references((): AnyPgColumn => user.id, {
    onDelete: "cascade",
  }),
  dateOfBirth: timestamp("date_of_birth"),
  phone: text("phone"),
  address: text("address"),
  isOnboarded: boolean("is_onboarded")
    .$defaultFn(() => false)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

// Educational Tables

export const subjects = pgTable("subjects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(), // Math, Science, English, etc.
  code: text("code").notNull().unique(), // MATH, SCI, ENG, etc.
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const classes = pgTable("classes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(), // Class 1, Class 2, etc.
  number: integer("number").notNull().unique(), // 1-12
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const books = pgTable("books", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  author: text("author"),
  publisher: text("publisher"),
  isbn: text("isbn"),
  pdfUrl: text("pdf_url").notNull(), // URL to uploaded PDF
  pdfSize: integer("pdf_size"), // File size in bytes
  totalPages: integer("total_pages").notNull(),
  coverImage: text("cover_image"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookPages = pgTable("book_pages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  imageUrl: text("image_url").notNull(), // Extracted page image
  textContent: text("text_content"), // OCR extracted text
  chapterTitle: text("chapter_title"), // Detected chapter title
  chapterNumber: integer("chapter_number"), // Detected chapter number
  isChapterStart: boolean("is_chapter_start").notNull().default(false),
  metadata: jsonb("metadata"), // Additional page data
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chapters = pgTable("chapters", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  chapterNumber: integer("chapter_number").notNull(),
  startPage: integer("start_page").notNull(), // Starting page in book
  endPage: integer("end_page").notNull(), // Ending page in book
  description: text("description"),
  objectives: text("objectives"), // Learning objectives
  duration: integer("duration"), // Estimated duration in minutes
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ncertContent = pgTable("ncert_content", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(), // Main content
  contentType: text("content_type").notNull(), // text, image, diagram, video
  order: integer("order").notNull(), // Order within chapter
  metadata: jsonb("metadata"), // Additional data like image URLs, video links
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const learningSessions = pgTable("learning_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  studentId: text("student_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  currentPageId: text("current_page_id").references(() => bookPages.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  sessionType: text("session_type").notNull(), // full_explanation, quick_summary, weak_topics
  status: learningSessionStatus("status").notNull().default("UPCOMING"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // Duration in minutes
  transcript: text("transcript"),
  summary: text("summary"),
  aiNotes: text("ai_notes"), // AI-generated notes
  studentFeedback: text("student_feedback"),
  parentNotes: text("parent_notes"),
  // Page tracking for split-screen UI
  pagesVisited: jsonb("pages_visited"), // Array of page IDs visited
  currentPageNumber: integer("current_page_number"),
  totalPagesInChapter: integer("total_pages_in_chapter"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tests = pgTable("tests", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  testType: testType("test_type").notNull(),
  duration: integer("duration").notNull(), // Duration in minutes
  totalMarks: integer("total_marks").notNull(),
  passingMarks: integer("passing_marks").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  testId: text("test_id")
    .notNull()
    .references(() => tests.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: questionType("question_type").notNull(),
  options: jsonb("options"), // For MCQ questions
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  marks: integer("marks").notNull().default(1),
  difficulty: difficultyLevel("difficulty").notNull().default("MEDIUM"),
  order: integer("order").notNull(), // Order within test
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const testAttempts = pgTable("test_attempts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  testId: text("test_id")
    .notNull()
    .references(() => tests.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull(),
  submittedAt: timestamp("submitted_at"),
  answers: jsonb("answers").notNull(), // Student's answers
  score: integer("score"),
  totalMarks: integer("total_marks").notNull(),
  percentage: integer("percentage"),
  isPassed: boolean("is_passed"),
  timeSpent: integer("time_spent"), // Time spent in minutes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const studentProgress = pgTable("student_progress", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  studentId: text("student_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  totalTimeSpent: integer("total_time_spent").notNull().default(0), // In minutes
  sessionsCompleted: integer("sessions_completed").notNull().default(0),
  testsAttempted: integer("tests_attempted").notNull().default(0),
  averageScore: integer("average_score"),
  strengths: jsonb("strengths"), // Array of strong topics
  weaknesses: jsonb("weaknesses"), // Array of weak topics
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const learningAnalytics = pgTable("learning_analytics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  studentId: text("student_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id").references(() => chapters.id, {
    onDelete: "cascade",
  }),
  subjectId: text("subject_id").references(() => subjects.id, {
    onDelete: "cascade",
  }),
  metricType: text("metric_type").notNull(), // session_time, test_score, completion_rate, etc.
  metricValue: integer("metric_value").notNull(),
  metadata: jsonb("metadata"), // Additional context
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pageInteractions = pgTable("page_interactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  sessionId: text("session_id")
    .notNull()
    .references(() => learningSessions.id, { onDelete: "cascade" }),
  pageId: text("page_id")
    .notNull()
    .references(() => bookPages.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  interactionType: text("interaction_type").notNull(), // question, explanation_request, page_navigation
  studentMessage: text("student_message"),
  aiResponse: text("ai_response"),
  timeSpentOnPage: integer("time_spent_on_page"), // Time in seconds
  isUnderstood: boolean("is_understood"), // Student's understanding level
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Meetings table for video call functionality
export const meetings = pgTable("meetings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  status: learningSessionStatus("status").notNull().default("UPCOMING"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // Duration in minutes
  transcriptUrl: text("transcript_url"),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Keep agents table for AI tutor functionality
export const agents = pgTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  instructions: text("instructions").notNull(),
  subjectId: text("subject_id").references(() => subjects.id, {
    onDelete: "cascade",
  }),
  classId: text("class_id").references(() => classes.id, {
    onDelete: "cascade",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
