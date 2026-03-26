

# Update RAG Chat System Prompt — Precision + Sales Mode

## Summary
Replace the current casual system prompt in `supabase/functions/rag-chat/index.ts` with the master RAG control prompt. This keeps the Silver Peak context but adds strict source-grounding, zero-hallucination rules, structured output format, and dual-layer response modes (Strict / Explain / Sales).

## What Changes

### 1. Replace SYSTEM_PROMPT in `supabase/functions/rag-chat/index.ts`

The new prompt will:
- Enforce source-only answers — no hallucination, no guessing
- Require `Answer:` + `Source:` output format by default
- Add internal validation logic (is this in the data?)
- Return "No reliable answer found in the provided knowledge base" when unsure
- Support three modes: **Strict** (default), **Explain** (if asked), **Sales** (if asked)
- Keep Silver Peak branding and agent-contracting focus as contextual framing
- Still inject retrieved Pinecone context the same way

### 2. Adjust context injection
Update the "no context found" fallback message to align with the new strict rules — instead of saying "answer based on general knowledge," it will say "No reliable answer found" when no documents match.

## What Stays the Same
- Embedding logic (Gemini embedding-001, 768 dims)
- Pinecone query logic
- Streaming via Lovable AI gateway
- Chat widget UI — no frontend changes
- All secrets and configuration

## Technical Details
- **File**: `supabase/functions/rag-chat/index.ts` — replace `SYSTEM_PROMPT` constant (lines 9-25) and update the `systemWithContext` fallback string (~line 92)
- No new dependencies, no migration, no config changes

