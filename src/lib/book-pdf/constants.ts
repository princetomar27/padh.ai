/** Render scale for page images (2 = readable on retina). */
export const PDF_RENDER_SCALE = 2;

/**
 * Pages per Inngest step. Larger batches = fewer Inngest steps for long books
 * (420 pages → ~21 steps at 20). Lower if a step hits memory/time limits.
 */
export const BOOK_PDF_PAGES_PER_STEP = 20;

/** Pipeline version stored on jobs for debugging / re-runs. */
export const BOOK_PDF_PIPELINE_VERSION = 1;

/** GPT-4o vision calls per Inngest step (limits step duration). */
export const BOOK_VISION_CHUNKS_PER_STEP = 4;

/**
 * Pages fetched per query in build-pdf-chunks. Each row carries large `metadata`
 * JSON; Neon HTTP driver caps responses at 64MB — batching avoids 507 errors.
 */
export const BOOK_PDF_CHUNK_BUILD_DB_PAGE_BATCH = 12;

/** Rows per query when listing vision targets (keeps Neon HTTP responses small). */
export const BOOK_PDF_VISION_LIST_DB_BATCH = 400;
