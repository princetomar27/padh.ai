-- Neon / older DBs may predate PAUSED on learning_session_status; queries that
-- filter on PAUSED otherwise fail with "invalid input value for enum".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'learning_session_status'
      AND e.enumlabel = 'PAUSED'
  ) THEN
    ALTER TYPE "public"."learning_session_status" ADD VALUE 'PAUSED';
  END IF;
END
$$;
