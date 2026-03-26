

# Fix RAG Upload Timeout Issue

## Problem
The edge function `rag-upload` is timing out. LlamaParse polling can take up to 2 minutes (60 polls × 2s each), which exceeds the default edge function timeout. The document is stuck at "Processing / 0 chunks."

## Solution

### 1. Clean up stuck document
Delete the stuck "ACA vs ERISA Comparison.pdf" record from the `documents` table so it doesn't clutter the admin view.

### 2. Increase edge function timeout
Add a configuration block in `supabase/config.toml` to set `wall_clock_limit` for `rag-upload` to 300 seconds (5 minutes), giving LlamaParse enough time to process.

### 3. Add a delete button to the admin page
Add a delete/retry button on each document row so the admin can remove failed uploads without needing database access.

### 4. Add better error handling
Wrap the LlamaParse polling in a try/catch that updates the document status to "error" if the function is about to timeout, so documents don't get stuck in "processing" forever.

## Technical Details

- `supabase/config.toml`: Add `[functions.rag-upload]` block with `wall_clock_limit = 300`
- `src/pages/Admin.tsx`: Add a delete button per document that calls `supabase.from("documents").delete().eq("id", doc.id)`
- `supabase/functions/rag-upload/index.ts`: Reduce LlamaParse poll iterations or add logging so we can diagnose failures

