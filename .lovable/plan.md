

# RAG Chat System + Admin Page for Silver Peak Health Plans

## Overview

Add a floating chat widget (bottom-right) to the existing landing page and an admin page for uploading PDFs. The landing page UI stays untouched. The RAG pipeline uses LlamaParse for PDF parsing, Pinecone for vector storage/retrieval, and Lovable AI for conversational responses with retrieved context.

All required secrets are already configured: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `LLAMA_PARSE_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_URL`, `LOVABLE_API_KEY`.

---

## Architecture

```text
User clicks chat icon → Chat widget opens (glassmorphism UI)
  → User sends question
  → Edge function "rag-chat":
      1. Embed query using Gemini embedding API
      2. Query Pinecone for relevant chunks
      3. Send context + question to Lovable AI (conversational, warm tone)
      4. Stream response back

Admin uploads PDF → Edge function "rag-upload":
      1. Parse PDF with LlamaParse → text chunks
      2. Embed chunks using Gemini embedding API
      3. Upsert vectors into Pinecone
```

---

## Implementation Steps

### 1. Database: documents table
Create a `documents` table to track uploaded PDFs (name, upload date, status, chunk count). No RLS needed initially since admin page will be simple/unprotected (or we add basic auth).

### 2. Edge Function: `rag-upload`
- Accepts PDF file upload (multipart form data)
- Sends PDF to LlamaParse API for text extraction
- Chunks the extracted text (~500 token chunks with overlap)
- Embeds each chunk using Gemini Embedding API (`text-embedding-004`)
- Upserts vectors into Pinecone with metadata (document name, chunk text)
- Updates document record in database with status/chunk count

### 3. Edge Function: `rag-chat`
- Accepts user message + conversation history
- Embeds the user query using Gemini Embedding API
- Queries Pinecone for top-5 similar chunks
- Constructs a system prompt: warm, conversational, agent-focused tone — positioned as a knowledgeable Silver Peak representative helping licensed agents understand the opportunity
- Sends context + conversation to Lovable AI (streaming)
- Returns streamed SSE response

### 4. Chat Widget Component (`src/components/ChatWidget.tsx`)
- **Collapsed state**: Small floating icon button (bottom-right, z-50), chat bubble icon with a subtle pulse animation
- **Expanded state**: Glassmorphism panel (~400x550px) with:
  - Frosted glass background (`backdrop-blur-xl`, semi-transparent bg, border glow)
  - Rounded corners (2xl), subtle 3D shadow/depth effect
  - Header with Silver Peak branding + close button
  - Message area with styled bubbles (user vs assistant)
  - Markdown rendering for assistant messages
  - Input bar with send button
  - Smooth open/close animation (scale + fade)
- Streams responses token-by-token
- Conversation persists during session (state only, no DB)

### 5. Admin Page (`/admin`)
- Route at `/admin`
- Simple upload interface: drag-and-drop or file picker for PDFs
- Shows list of uploaded documents with status (processing/ready/error)
- Upload progress indicator
- Uses the `rag-upload` edge function
- Clean, minimal UI matching the dark theme

### 6. Integration
- Add `<ChatWidget />` to `Index.tsx` (no other changes to the page)
- Add `/admin` route to `App.tsx`

---

## Technical Details

- **Embedding model**: Gemini `text-embedding-004` (768 dimensions) via `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`
- **Chat LLM**: Lovable AI gateway with `google/gemini-3-flash-preview` — system prompt tuned for warm, conversational, non-robotic tone focused on agent contracting
- **Pinecone**: Uses the configured `PINECONE_INDEX_URL` for upsert and query operations
- **LlamaParse**: `https://api.cloud.llamaindex.ai/api/parsing` for PDF extraction
- **Chunking**: ~500 tokens per chunk, 50-token overlap

