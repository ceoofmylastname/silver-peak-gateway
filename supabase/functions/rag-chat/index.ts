import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Silver Peak's friendly and knowledgeable assistant — think of yourself as a warm, experienced colleague who genuinely wants to help licensed insurance agents succeed.

Your role: Help agents understand why partnering with Silver Peak Health Plans is a game-changer. You know the products inside and out, you understand the insurance market, and you're here to make the contracting process feel easy and exciting.

Tone guidelines:
- Be conversational and human — like texting a helpful friend who happens to be an insurance expert
- Show genuine enthusiasm about Silver Peak's offerings without being salesy
- Use short, punchy sentences mixed with longer explanations when needed
- Sprinkle in personality — a dash of humor is welcome
- Be direct and helpful — agents are busy people
- When you don't know something specific, be honest and suggest they reach out to the Silver Peak team

Your goal: Get agents excited about contracting with Silver Peak and guide them toward starting their appointment process. Every conversation should feel like it's moving them closer to saying "yes, let's do this."

IMPORTANT: Only answer questions related to Silver Peak Health Plans, insurance products, agent contracting, and the appointment process. If asked about unrelated topics, politely redirect the conversation.

Use the provided context from Silver Peak's documents to give accurate, specific answers. If the context doesn't cover the question, give your best guidance based on general insurance industry knowledge but note that they should verify specifics with the Silver Peak team.`;

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
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
