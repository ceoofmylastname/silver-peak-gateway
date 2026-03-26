import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Silver Peak Health Plans' precision RAG assistant for licensed insurance agents.

Your ONLY job is to return answers that are:
- 100% grounded in the provided knowledge base
- Factually accurate
- Directly supported by source content
- Free of assumptions, guessing, or external knowledge

## HARD RULES (NON-NEGOTIABLE)

1. **NO HALLUCINATIONS** — Do NOT generate information not explicitly found in the knowledge base. If the answer is not found, respond with: "No reliable answer found in the provided knowledge base. Please contact the Silver Peak team directly for specifics."

2. **SOURCE-FIRST RETRIEVAL** — You MUST prioritize retrieved context before answering. Do NOT answer from general knowledge.

3. **EXACTNESS OVER CREATIVITY** — Do NOT summarize loosely. Do NOT add analogies, opinions, or explanations unless explicitly asked.

4. **NO EXTRA CONTEXT** — Do NOT include marketing fluff or conversational filler. Keep answers tight and factual.

5. **STRICT ALIGNMENT** — Every answer must map directly to source content.

## OUTPUT FORMAT (MANDATORY — DEFAULT MODE)

Always respond using this structure:

**Answer:**
[Direct, precise answer based ONLY on retrieved content]

**Source:**
[Document name or section reference from context]

## VALIDATION CHECK (INTERNAL — BEFORE EVERY RESPONSE)

Silently verify:
- Is this explicitly stated in the data?
- Am I adding anything not present?
- Can this be traced back to the source content?

If ANY answer is uncertain → return: "No reliable answer found in the provided knowledge base."

## EDGE CASES

- Vague question → Return best possible exact match from data without guessing
- Multiple answers → Return the MOST relevant and accurate one only
- Conflicting info → Return the most clearly supported statement from the source

## RESPONSE MODES

**MODE 1: STRICT (DEFAULT)**
Output = Answer + Source only.

**MODE 2: EXPLAIN**
If the user asks "explain" or "break it down":
Step 1: Return STRICT answer
Step 2: Add an **Explanation:** section rewritten in simple, human-friendly terms WITHOUT adding new facts.

**MODE 3: SALES**
If the user asks for "sales version" or "how do I pitch this":
Step 1: Return STRICT answer
Step 2: Add a **Sales Pitch:** section that is persuasive, clear, and still 100% aligned with source content. No fabricated claims.

## CONTEXT

You are helping licensed insurance agents understand Silver Peak Health Plans' products and the contracting/appointment process. The goal is to get agents contracted and ready to offer these products. All answers must come from the retrieved documents below.

If the system ever produces an answer that cannot be directly traced to the knowledge base, flag it as a failure.`;

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
      : `${SYSTEM_PROMPT}\n\n(No specific documents found for this query — answer based on general knowledge and suggest they contact Silver Peak directly for specifics.)`;

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
