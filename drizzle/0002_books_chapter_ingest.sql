ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "chapter_ingest_sources" jsonb;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "expected_chapter_count" integer;
