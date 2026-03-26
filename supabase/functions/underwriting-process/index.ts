import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY");
    const PINECONE_INDEX_URL = Deno.env.get("PINECONE_INDEX_URL");
    const LLAMA_PARSE_API_KEY = Deno.env.get("LLAMA_PARSE_API_KEY");

    if (!GEMINI_API_KEY || !PINECONE_API_KEY || !PINECONE_INDEX_URL || !LLAMA_PARSE_API_KEY) {
      throw new Error("Missing required API keys");
    }

    const formData = await req.formData();
    const carrierName = formData.get("carrier_name") as string;
    const file = formData.get("file") as File;

    if (!carrierName || !file) {
      return new Response(JSON.stringify({ error: "carrier_name and file are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Upload to LlamaParse
    const llamaForm = new FormData();
    llamaForm.append("file", file);
    llamaForm.append("result_type", "markdown");

    const uploadRes = await fetch("https://api.cloud.llamaindex.ai/api/parsing/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${LLAMA_PARSE_API_KEY}` },
      body: llamaForm,
    });

    if (!uploadRes.ok) throw new Error(`LlamaParse upload failed: ${uploadRes.status}`);
    const { id: jobId } = await uploadRes.json();

    // Step 2: Poll for completion
    let markdown = "";
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { Authorization: `Bearer ${LLAMA_PARSE_API_KEY}` },
      });
      const statusData = await statusRes.json();
      if (statusData.status === "SUCCESS") {
        const resultRes = await fetch(
          `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
          { headers: { Authorization: `Bearer ${LLAMA_PARSE_API_KEY}` } }
        );
        const resultData = await resultRes.json();
        markdown = resultData.markdown;
        break;
      } else if (statusData.status === "ERROR") {
        throw new Error("LlamaParse processing failed");
      }
    }

    if (!markdown) throw new Error("LlamaParse timed out");

    // Step 3: Chunk by markdown headers
    const sections = markdown.split(/(?=^#{1,3}\s)/m).filter((s: string) => s.trim());
    const chunks: { text: string; section: string }[] = [];

    for (const section of sections) {
      const headerMatch = section.match(/^(#{1,3})\s+(.+)/);
      const sectionTitle = headerMatch ? headerMatch[2].trim() : "General";
      const text = `Carrier: ${carrierName}\nSection: ${sectionTitle}\n\n${section.trim()}`;

      // Split large sections into ~1000 char chunks
      if (text.length > 1200) {
        const words = text.split(/\s+/);
        let current = "";
        for (const word of words) {
          if ((current + " " + word).length > 1000 && current) {
            chunks.push({ text: current, section: sectionTitle });
            current = `Carrier: ${carrierName}\nSection: ${sectionTitle} (cont.)\n\n${word}`;
          } else {
            current = current ? current + " " + word : word;
          }
        }
        if (current) chunks.push({ text: current, section: sectionTitle });
      } else {
        chunks.push({ text, section: sectionTitle });
      }
    }

    // Step 4: Embed with Gemini
    const vectors: { id: string; values: number[]; metadata: Record<string, string> }[] = [];

    // Batch embed in groups of 10
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: batch.map((c) => ({
              model: "models/gemini-embedding-001",
              content: { parts: [{ text: c.text }] },
              taskType: "RETRIEVAL_DOCUMENT",
              outputDimensionality: 768,
            })),
          }),
        }
      );

      // Fallback: embed one at a time if batch fails
      if (!embedRes.ok) {
        for (let j = 0; j < batch.length; j++) {
          const singleRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "models/gemini-embedding-001",
                content: { parts: [{ text: batch[j].text }] },
                taskType: "RETRIEVAL_DOCUMENT",
                outputDimensionality: 768,
              }),
            }
          );
          if (!singleRes.ok) {
            console.error(`Embed failed for chunk ${i + j}`);
            continue;
          }
          const singleData = await singleRes.json();
          vectors.push({
            id: `${carrierName}-${i + j}`,
            values: singleData.embedding.values,
            metadata: {
              carrier: carrierName,
              section: batch[j].section,
              text: batch[j].text,
              source_file: file.name,
            },
          });
        }
        continue;
      }

      const embedData = await embedRes.json();
      const embeddings = embedData.embeddings || [embedData.embedding];
      for (let j = 0; j < embeddings.length; j++) {
        vectors.push({
          id: `${carrierName}-${i + j}`,
          values: embeddings[j].values,
          metadata: {
            carrier: carrierName,
            section: batch[j].section,
            text: batch[j].text,
            source_file: file.name,
          },
        });
      }
    }

    // Step 5: Upsert to Pinecone
    const pineconeUrl = PINECONE_INDEX_URL.endsWith("/")
      ? PINECONE_INDEX_URL
      : PINECONE_INDEX_URL + "/";

    // Upsert in batches of 100
    for (let i = 0; i < vectors.length; i += 100) {
      const batch = vectors.slice(i, i + 100);
      const upsertRes = await fetch(`${pineconeUrl}vectors/upsert`, {
        method: "POST",
        headers: {
          "Api-Key": PINECONE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vectors: batch }),
      });
      if (!upsertRes.ok) {
        const errText = await upsertRes.text();
        console.error(`Pinecone upsert failed: ${errText}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunks_processed: vectors.length,
        carrier: carrierName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("underwriting-process error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
