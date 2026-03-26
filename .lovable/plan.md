

# RAG Chat Widget for Silver Peak Health Plans

## Overview

Build a floating chat widget (bottom-right corner) that, when clicked, expands into a glassmorphic AI-powered chat interface. The system uses Gemini embeddings + Pinecone vector search + Claude for conversational responses about Silver Peak Health Plans products, helping licensed agents understand offerings and get contracted.

## Architecture

```text
┌─────────────────────────────────────┐
│  Frontend (React)                   │
│  ┌─────────────────────────────┐    │
│  │ ChatWidget.tsx               │    │
│  │  - Floating icon (bottom-R) │    │
│  │  - Glassmorphic chat panel  │    │
│  │  - Streaming message render │    │
│  │  - Markdown support         │    │
│  └──────────┬──────────────────┘    │
│             │ POST                  │
│             ▼                       │
│  supabase/functions/                │
│  ├─ underwriting-chat/index.ts      │
│  │   Gemini embed → Pinecone query  │
│  │   → Claude streaming response    │
│  └─ underwriting-process/index.ts   │
│      LlamaParse → Gemini embed      │
│      → Pinecone upsert             │
└─────────────────────────────────────┘
```

## Step 1: Add API Keys as Secrets

Add these 5 secrets (user provided values) to the project:
- `GEMINI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_URL`
- `ANTHROPIC_API_KEY`
- `LLAMA_PARSE_API_KEY`

## Step 2: Create `underwriting-process` Edge Function

**File:** `supabase/functions/underwriting-process/index.ts`

- Accepts multipart/form-data with `carrier_name` and `file`
- Uploads PDF to LlamaParse API, polls for completion, fetches markdown
- Chunks by markdown headers, each prefixed with carrier + section context
- Embeds each chunk via Gemini `gemini-embedding-001` (768 dims, `RETRIEVAL_DOCUMENT` task type, `v1beta` endpoint)
- Upserts vectors to Pinecone with metadata: carrier, section, text, source_file

## Step 3: Create `underwriting-chat` Edge Function

**File:** `supabase/functions/underwriting-chat/index.ts`

- Accepts JSON with `question` and `messages` (conversation history)
- Embeds question via Gemini `gemini-embedding-001` (768 dims, `RETRIEVAL_QUERY`, `v1beta` endpoint)
- Queries Pinecone with topK 6, filters matches below 0.75 similarity
- Passes context + conversation history to Claude `claude-sonnet-4-20250514` with streaming
- System prompt: conversational insurance advisor tone — asks clarifying questions when profile is incomplete, leads with direct answers, cites sources, never robotic
- Returns SSE stream in OpenAI-compatible format

## Step 4: Build the Chat Widget UI

**File:** `src/components/ChatWidget.tsx`

**Closed state:**
- Small floating button, bottom-right corner (fixed position)
- Chat bubble icon with subtle pulse/glow animation
- Gold accent color matching brand

**Open state (glassmorphic panel):**
- Smooth expand animation (scale + fade)
- `backdrop-blur-xl` + semi-transparent bg + border with subtle glow
- Rounded corners (2xl), shadow with brand color tint
- 3D depth effect via layered shadows and subtle gradients
- Header with Silver Peak branding + close button
- Message area with scrolling, markdown rendering via `react-markdown`
- Clarifying questions rendered with teal left border
- Quick prompt chips on empty state (e.g. "What carriers do you offer?", "How do I get appointed?")
- Input bar at bottom with send button
- Typing indicator with animated dots
- Source citation badges on assistant messages
- Responsive: ~400px wide on desktop, full-width on mobile

## Step 5: Wire into App

- Import `ChatWidget` in `App.tsx` and render it globally (outside Routes)
- Add route `/rag-emb-2` if needed or keep it as a global overlay widget
- Register both edge functions in `supabase/config.toml` with `verify_jwt = false`
- Install `react-markdown` dependency

## Technical Details

- **Gemini model:** `gemini-embedding-001` on `v1beta` endpoint (NOT `text-embedding-004`, NOT `v1`)
- **Dimensions:** 768 (Matryoshka compression, matches Pinecone index)
- **Claude model:** `claude-sonnet-4-20250514` with SSE streaming
- **Similarity threshold:** 0.75 minimum
- **TopK:** 6 chunks retrieved per query
- **Conversation memory:** Full history sent with each request so Claude maintains context

