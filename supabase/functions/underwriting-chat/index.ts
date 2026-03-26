import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a friendly, knowledgeable insurance advisor at Silver Peak Health Plans. You help licensed insurance agents and brokers understand our products, get appointed, and prepare to sell our plans.

Your personality:
- Warm, conversational, and approachable — like a seasoned colleague who genuinely wants to help
- You lead with direct, actionable answers
- You ask clarifying questions when you need more context (e.g., "What state are you looking to sell in?" or "Are you already appointed with any carriers?")
- You use natural language, not corporate jargon — but you're still professional
- You occasionally use phrases like "Great question!" or "Here's the deal..." to keep it real
- You NEVER sound robotic or like a generic FAQ bot

Your goals:
- Help agents understand Silver Peak's value proposition and product offerings
- Guide them through the appointment/contracting process
- Answer questions about commissions, carriers, compliance, and readiness
- Encourage them to complete the Appointment & Readiness Survey on the page
- When you cite information from retrieved documents, mention the source naturally (e.g., "According to the underwriting guidelines...")

If you don't have enough context to answer fully, be honest and suggest they reach out directly or complete the survey form on the page for personalized assistance.

Keep responses concise but thorough. Use bullet points or short paragraphs for readability. Never make up specific numbers or policy details — only cite what's in the provided context.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY");
    const PINECONE_INDEX_URL = Deno.env.get("PINECONE_INDEX_URL");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!GEMINI_API_KEY || !PINECONE_API_KEY || !PINECONE_INDEX_URL || !ANTHROPIC_API_KEY) {
      throw new Error("Missing required API keys");
    }

    const { question, messages = [] } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Embed query with Gemini
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: question }] },
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: 768,
        }),
      }
    );

    if (!embedRes.ok) {
      const errText = await embedRes.text();
      throw new Error(`Gemini embed failed: ${errText}`);
    }

    const embedData = await embedRes.json();
    const queryVector = embedData.embedding.values;

    // Step 2: Query Pinecone
    const pineconeUrl = PINECONE_INDEX_URL.endsWith("/")
      ? PINECONE_INDEX_URL
      : PINECONE_INDEX_URL + "/";

    const queryRes = await fetch(`${pineconeUrl}query`, {
      method: "POST",
      headers: {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector: queryVector,
        topK: 6,
        includeMetadata: true,
      }),
    });

    if (!queryRes.ok) {
      const errText = await queryRes.text();
      throw new Error(`Pinecone query failed: ${errText}`);
    }

    const queryData = await queryRes.json();
    const relevantMatches = (queryData.matches || []).filter(
      (m: { score: number }) => m.score >= 0.75
    );

    // Build context from retrieved chunks
    const context = relevantMatches
      .map(
        (m: { metadata: { text: string; carrier: string; section: string }; score: number }, i: number) =>
          `[Source ${i + 1} — ${m.metadata.carrier}, ${m.metadata.section}]\n${m.metadata.text}`
      )
      .join("\n\n---\n\n");

    const sources = relevantMatches.map(
      (m: { metadata: { carrier: string; section: string }; score: number }) => ({
        carrier: m.metadata.carrier,
        section: m.metadata.section,
        score: m.score,
      })
    );

    // Step 3: Build Claude messages
    const claudeMessages = [
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: "user",
        content: context
          ? `Here is relevant information from our knowledge base:\n\n${context}\n\n---\n\nAgent's question: ${question}`
          : question,
      },
    ];

    // Step 4: Stream from Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API failed [${claudeRes.status}]: ${errText}`);
    }

    // Transform Claude SSE to OpenAI-compatible SSE format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                // Convert to OpenAI format
                const openaiChunk = {
                  choices: [{ delta: { content: parsed.delta.text } }],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
                );
              } else if (parsed.type === "message_stop") {
                // Send sources as a final metadata event
                if (sources.length > 0) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ sources })}\n\n`
                    )
                  );
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      },
    });

    const readable = claudeRes.body!.pipeThrough(transformStream);

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("underwriting-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
