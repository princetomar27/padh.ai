DO $$ BEGIN CREATE TYPE "public"."agent_role" AS ENUM('TUTOR', 'ASSESSOR'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."difficulty_level" AS ENUM('EASY', 'MEDIUM', 'HARD'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."language_preference" AS ENUM('ENGLISH', 'HINGLISH'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."learning_session_status" AS ENUM('UPCOMING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."processing_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."question_source" AS ENUM('BOOK', 'PYQ', 'AI_GENERATED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."question_type" AS ENUM('MCQ', 'SHORT_ANSWER', 'LONG_ANSWER', 'TRUE_FALSE', 'FILL_IN_BLANK'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."storage_provider" AS ENUM('VERCEL_BLOB', 'SUPABASE_STORAGE', 'S3'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."test_type" AS ENUM('MCQ', 'SHORT_ANSWER', 'LONG_ANSWER', 'MIXED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'PARENT', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agent_role" "agent_role" DEFAULT 'TUTOR' NOT NULL,
	"instructions" text NOT NULL,
	"subject_id" text NOT NULL,
	"class_id" text NOT NULL,
	"voice_id" text DEFAULT 'nova' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"image_url" text NOT NULL,
	"text_content" text,
	"chapter_title" text,
	"chapter_number" integer,
	"is_chapter_start" boolean DEFAULT false NOT NULL,
	"has_equations" boolean DEFAULT false NOT NULL,
	"has_images" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_processing_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"inngest_run_id" text,
	"status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"chunks_extracted" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"class_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"author" text,
	"publisher" text,
	"isbn" text,
	"supabase_storage_url" text,
	"vercel_blob_url" text,
	"storage_provider" "storage_provider" DEFAULT 'SUPABASE_STORAGE' NOT NULL,
	"pdf_size" integer,
	"total_pages" integer DEFAULT 0 NOT NULL,
	"cover_image" text,
	"processing_status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"class_id" text NOT NULL,
	"title" text NOT NULL,
	"chapter_number" integer NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"description" text,
	"objectives" text,
	"duration" integer,
	"processing_status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"questions_generated" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"number" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "important_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"pyq_paper_id" text,
	"pdf_chunk_id" text,
	"question_text" text NOT NULL,
	"question_type" "question_type" NOT NULL,
	"options" jsonb,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"marks" integer DEFAULT 1 NOT NULL,
	"difficulty" "difficulty_level" DEFAULT 'MEDIUM' NOT NULL,
	"source" "question_source" NOT NULL,
	"pyq_year" integer,
	"order_in_chapter" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"chapter_id" text,
	"subject_id" text,
	"session_id" text,
	"metric_type" text NOT NULL,
	"metric_value" real NOT NULL,
	"metadata" jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"book_id" text NOT NULL,
	"agent_id" text,
	"title" text NOT NULL,
	"session_type" text DEFAULT 'full_explanation' NOT NULL,
	"status" "learning_session_status" DEFAULT 'UPCOMING' NOT NULL,
	"current_chunk_id" text,
	"current_chunk_index" integer,
	"language_preference" "language_preference" DEFAULT 'ENGLISH' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration_seconds" integer,
	"transcript" text,
	"summary" text,
	"ai_notes" text,
	"student_feedback" text,
	"parent_notes" text,
	"chunks_visited" jsonb,
	"pages_visited" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"book_page_id" text NOT NULL,
	"pdf_chunk_id" text,
	"student_id" text NOT NULL,
	"interaction_type" text NOT NULL,
	"student_message" text,
	"ai_response" text,
	"time_spent_on_page_seconds" integer,
	"is_understood" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdf_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"book_page_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"order_in_chapter" integer NOT NULL,
	"text" text NOT NULL,
	"bounding_boxes" jsonb NOT NULL,
	"is_equation" boolean DEFAULT false NOT NULL,
	"equation_description" text,
	"is_image" boolean DEFAULT false NOT NULL,
	"image_description" text,
	"speak_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pyq_papers" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"exam_year" integer NOT NULL,
	"board_name" text DEFAULT 'CBSE' NOT NULL,
	"pdf_url" text NOT NULL,
	"cover_image" text,
	"total_marks" integer,
	"duration_minutes" integer,
	"processing_status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"pdf_chunk_id" text,
	"question_text" text NOT NULL,
	"question_type" "question_type" NOT NULL,
	"options" jsonb,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"marks" integer DEFAULT 1 NOT NULL,
	"difficulty" "difficulty_level" DEFAULT 'MEDIUM' NOT NULL,
	"order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"completion_percentage" real DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"total_time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"sessions_completed" integer DEFAULT 0 NOT NULL,
	"tests_attempted" integer DEFAULT 0 NOT NULL,
	"average_score" real,
	"strengths" jsonb,
	"weaknesses" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "test_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"student_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"answers" jsonb NOT NULL,
	"score" integer,
	"total_marks" integer NOT NULL,
	"percentage" real,
	"is_passed" boolean,
	"time_spent_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"test_type" "test_type" NOT NULL,
	"duration" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"passing_marks" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"class" integer,
	"school" text,
	"phone" text,
	"city" text,
	"language_preference" "language_preference" DEFAULT 'ENGLISH' NOT NULL,
	"parent_id" text,
	"is_onboarded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_processing_jobs" ADD CONSTRAINT "book_processing_jobs_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_questions" ADD CONSTRAINT "important_questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_questions" ADD CONSTRAINT "important_questions_pyq_paper_id_pyq_papers_id_fk" FOREIGN KEY ("pyq_paper_id") REFERENCES "public"."pyq_papers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "important_questions" ADD CONSTRAINT "important_questions_pdf_chunk_id_pdf_chunks_id_fk" FOREIGN KEY ("pdf_chunk_id") REFERENCES "public"."pdf_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics" ADD CONSTRAINT "learning_analytics_student_id_user_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics" ADD CONSTRAINT "learning_analytics_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics" ADD CONSTRAINT "learning_analytics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_analytics" ADD CONSTRAINT "learning_analytics_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_student_id_user_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_current_chunk_id_pdf_chunks_id_fk" FOREIGN KEY ("current_chunk_id") REFERENCES "public"."pdf_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_interactions" ADD CONSTRAINT "page_interactions_session_id_learning_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_interactions" ADD CONSTRAINT "page_interactions_book_page_id_book_pages_id_fk" FOREIGN KEY ("book_page_id") REFERENCES "public"."book_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_interactions" ADD CONSTRAINT "page_interactions_pdf_chunk_id_pdf_chunks_id_fk" FOREIGN KEY ("pdf_chunk_id") REFERENCES "public"."pdf_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_interactions" ADD CONSTRAINT "page_interactions_student_id_user_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_chunks" ADD CONSTRAINT "pdf_chunks_book_page_id_book_pages_id_fk" FOREIGN KEY ("book_page_id") REFERENCES "public"."book_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_chunks" ADD CONSTRAINT "pdf_chunks_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pyq_papers" ADD CONSTRAINT "pyq_papers_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pyq_papers" ADD CONSTRAINT "pyq_papers_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_pdf_chunk_id_pdf_chunks_id_fk" FOREIGN KEY ("pdf_chunk_id") REFERENCES "public"."pdf_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_student_id_user_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_student_id_user_profiles_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_parent_id_user_profiles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_agents_subject_class_role" ON "agents" USING btree ("subject_id","class_id","agent_role");--> statement-breakpoint
CREATE INDEX "idx_agents_subject_class" ON "agents" USING btree ("subject_id","class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_book_pages_book_page" ON "book_pages" USING btree ("book_id","page_number");--> statement-breakpoint
CREATE INDEX "idx_book_pages_book_id" ON "book_pages" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_book_pages_chapter_number" ON "book_pages" USING btree ("book_id","chapter_number");--> statement-breakpoint
CREATE INDEX "idx_book_processing_jobs_book_id" ON "book_processing_jobs" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_book_processing_jobs_status" ON "book_processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_book_processing_jobs_inngest_run" ON "book_processing_jobs" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE INDEX "idx_books_subject_class" ON "books" USING btree ("subject_id","class_id");--> statement-breakpoint
CREATE INDEX "idx_books_processing_status" ON "books" USING btree ("processing_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chapters_book_chapter_num" ON "chapters" USING btree ("book_id","chapter_number");--> statement-breakpoint
CREATE INDEX "idx_chapters_book_id" ON "chapters" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "idx_chapters_subject_class" ON "chapters" USING btree ("subject_id","class_id");--> statement-breakpoint
CREATE INDEX "idx_chapters_processing_status" ON "chapters" USING btree ("processing_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_class_subjects_class_subject" ON "class_subjects" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "idx_class_subjects_class_id" ON "class_subjects" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_class_subjects_subject_id" ON "class_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_important_questions_chapter_order" ON "important_questions" USING btree ("chapter_id","order_in_chapter");--> statement-breakpoint
CREATE INDEX "idx_important_questions_pyq_paper" ON "important_questions" USING btree ("pyq_paper_id");--> statement-breakpoint
CREATE INDEX "idx_important_questions_difficulty" ON "important_questions" USING btree ("chapter_id","difficulty");--> statement-breakpoint
CREATE INDEX "idx_important_questions_source" ON "important_questions" USING btree ("chapter_id","source");--> statement-breakpoint
CREATE INDEX "idx_learning_analytics_student" ON "learning_analytics" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_learning_analytics_student_subject" ON "learning_analytics" USING btree ("student_id","subject_id");--> statement-breakpoint
CREATE INDEX "idx_learning_analytics_student_chapter" ON "learning_analytics" USING btree ("student_id","chapter_id");--> statement-breakpoint
CREATE INDEX "idx_learning_analytics_recorded_at" ON "learning_analytics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_learning_sessions_student_chapter" ON "learning_sessions" USING btree ("student_id","chapter_id");--> statement-breakpoint
CREATE INDEX "idx_learning_sessions_student_status" ON "learning_sessions" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_learning_sessions_chapter_status" ON "learning_sessions" USING btree ("chapter_id","status");--> statement-breakpoint
CREATE INDEX "idx_learning_sessions_student_created" ON "learning_sessions" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_page_interactions_session" ON "page_interactions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_page_interactions_student" ON "page_interactions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_page_interactions_chunk" ON "page_interactions" USING btree ("pdf_chunk_id");--> statement-breakpoint
CREATE INDEX "idx_pdf_chunks_chapter_order" ON "pdf_chunks" USING btree ("chapter_id","order_in_chapter");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pdf_chunks_page_chunk_idx" ON "pdf_chunks" USING btree ("book_page_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_pdf_chunks_book_page_id" ON "pdf_chunks" USING btree ("book_page_id");--> statement-breakpoint
CREATE INDEX "idx_pdf_chunks_chapter_equation" ON "pdf_chunks" USING btree ("chapter_id","is_equation");--> statement-breakpoint
CREATE INDEX "idx_pyq_papers_class_subject" ON "pyq_papers" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "idx_pyq_papers_exam_year" ON "pyq_papers" USING btree ("exam_year");--> statement-breakpoint
CREATE INDEX "idx_questions_test_id" ON "questions" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_questions_chapter_id" ON "questions" USING btree ("chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_student_progress_student_chapter" ON "student_progress" USING btree ("student_id","chapter_id");--> statement-breakpoint
CREATE INDEX "idx_student_progress_student" ON "student_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_student_progress_student_accessed" ON "student_progress" USING btree ("student_id","last_accessed_at");--> statement-breakpoint
CREATE INDEX "idx_test_attempts_student_test" ON "test_attempts" USING btree ("student_id","test_id");--> statement-breakpoint
CREATE INDEX "idx_test_attempts_student" ON "test_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_test_attempts_test_id" ON "test_attempts" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_tests_chapter_id" ON "tests" USING btree ("chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_profiles_clerk_id" ON "user_profiles" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_parent_id" ON "user_profiles" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_role_class" ON "user_profiles" USING btree ("role","class");