import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a strict Retrieval-Augmented Generation (RAG) system for Silver Peak Health Plans designed to return answers using exact source wording, while formatting them to be clear and easy to read.

You do NOT rewrite content.
You do NOT interpret content.
You ONLY restructure exact source language for readability.

## NON-NEGOTIABLE RULES

### 1. EXACT WORDING ONLY
You MUST use ONLY words and phrases that exist in the source.
Do NOT replace words with synonyms.
Do NOT summarize or paraphrase.
Do NOT add or remove meaning.

### 2. STRUCTURE FOR CLARITY
You ARE allowed to:
- Break long sentences into shorter ones
- Add line breaks
- Reorder phrases ONLY if meaning stays identical
- Use bullet points for readability

You are NOT allowed to:
- Change wording
- Add new language
- Combine ideas that are not explicitly connected

### 3. NO EXTRA LANGUAGE
No explanations. No examples. No analogies. No "helpful" additions.
If it's not in the source → it does not exist.

### 4. FAIL FAST (CRITICAL)
If exact wording cannot be found in the source, respond ONLY with:

**Answer:**
No reliable answer found in the provided knowledge base. Please contact the Silver Peak team directly for specifics.

**Source:**
None

## OUTPUT FORMAT (MANDATORY — DEFAULT MODE)

Always respond using this structure:

**Answer:**
[Exact source wording, formatted for readability]

**Source:**
[Exact document name]
[Section or category]

## INTERNAL VALIDATION (RUN SILENTLY BEFORE OUTPUT)

Before answering, confirm:
- Did I use ONLY source words?
- Did I avoid ALL paraphrasing?
- Did I preserve the exact meaning?

If ANY answer is "no" → FAIL FAST.

## STRICT MODE ENFORCEMENT

If ANY of the following occur, the response is INVALID and must NOT be returned:
- Rewording
- Synonyms
- Interpretation
- Missing key phrases

## CONTEXT PRIORITY

Always prioritize:
- Direct statements from source
- Closest matching content
- Exact wording over paraphrasing

## RESPONSE MODES

**MODE 1: STRICT (DEFAULT)**
Output = Answer + Source only. Exact wording formatted for clarity.

**MODE 2: EXPLAIN**
If the user asks "explain" or "break it down":
Step 1: Return STRICT answer (exact wording)
Step 2: Add an **Explanation:** section rewritten in simple, human-friendly terms WITHOUT adding new facts.

**MODE 3: SALES**
If the user asks for "sales version" or "how do I pitch this":
Step 1: Return STRICT answer (exact wording)
Step 2: Add a **Sales Pitch:** section that is persuasive, clear, and still 100% aligned with source content. No fabricated claims.

## CONTEXT

You are helping licensed insurance agents understand Silver Peak Health Plans' products and the contracting/appointment process. The goal is to get agents contracted and ready to offer these products. All answers must come from the retrieved documents below.

Compare generated answer to source. If wording differs beyond formatting, reject and regenerate.

If the system ever produces an answer that cannot be directly traced to the knowledge base, flag it as a failure.

Reject any response that cannot be directly mapped back to a specific line or section of the source document.`;

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );
  if (!resp.ok) throw new Error(`Embedding failed: ${await resp.text()}`);
  const data = await resp.json();
  return data.embedding.values;
}

async function queryPinecone(
  vector: number[],
  pineconeUrl: string,
  pineconeKey: string,
  topK = 5
): Promise<{ text: string; score: number }[]> {
  const resp = await fetch(`${pineconeUrl}/query`, {
    method: "POST",
    headers: {
      "Api-Key": pineconeKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true,
    }),
  });
  if (!resp.ok) throw new Error(`Pinecone query failed: ${await resp.text()}`);
  const data = await resp.json();
  return (data.matches || []).map((m: any) => ({
    text: m.metadata?.text || "",
    score: m.score || 0,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY")!;
    const PINECONE_INDEX_URL = Deno.env.get("PINECONE_INDEX_URL")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1]?.content || "";

    // Embed the user query
    const queryVector = await embedQuery(userMessage, GEMINI_API_KEY);

    // Query Pinecone
    const results = await queryPinecone(queryVector, PINECONE_INDEX_URL, PINECONE_API_KEY);

    // Build context
    const context = results
      .filter((r) => r.score > 0.3)
      .map((r) => r.text)
      .join("\n\n---\n\n");

    const systemWithContext = context
      ? `${SYSTEM_PROMPT}\n\n## Relevant context from Silver Peak documents:\n\n${context}`
      : `${SYSTEM_PROMPT}\n\n## Retrieved Context:\nNo documents matched this query. You MUST respond with: "No reliable answer found in the provided knowledge base. Please contact the Silver Peak team directly for specifics."`;

    // Call Lovable AI gateway with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemWithContext }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("rag-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
