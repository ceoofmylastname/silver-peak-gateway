

# Update RAG System Prompt — Ultra-Strict Source-Locked Mode

## Summary
Replace the current `SYSTEM_PROMPT` in `supabase/functions/rag-chat/index.ts` with the new ultra-strict, source-locked prompt. This tightens the existing rules further — zero expansion, no helpful AI behavior, fail-fast on uncertainty, audit-proof outputs.

## What Changes

### 1. Replace `SYSTEM_PROMPT` in `supabase/functions/rag-chat/index.ts`
Swap the current prompt (lines ~9–67) with the new strict prompt that enforces:
- **Source-locked answers only** — every word must trace to source
- **Zero expansion policy** — no synonyms, analogies, clarifications
- **No outside knowledge** — ignore everything not in documents
- **Fail fast** — if not 100% certain, return "No reliable answer found"
- **Internal validation** — silent pre-output checks
- **Strict mode enforcement** — reject any response with interpretation
- Keep Silver Peak agent-contracting context framing
- Keep the three response modes (Strict default, Explain, Sales) as a stacked second layer

### 2. No-context fallback stays aligned
Already returns the strict fallback message — no change needed there.

## What Stays the Same
- Embedding logic, Pinecone query, streaming, chat widget UI, all secrets

## Technical Details
- **File**: `supabase/functions/rag-chat/index.ts` — replace `SYSTEM_PROMPT` constant only
- No migrations, no config changes, no frontend changes

