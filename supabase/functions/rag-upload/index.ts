import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

async function parseWithLlamaParse(pdfBytes: Uint8Array, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "document.pdf");

  const uploadResp = await fetch("https://api.cloud.llamaindex.ai/api/parsing/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!uploadResp.ok) {
    const err = await uploadResp.text();
    throw new Error(`LlamaParse upload failed: ${err}`);
  }

  const { id: jobId } = await uploadResp.json();

  // Poll for completion
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusResp = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const statusData = await statusResp.json();
    console.log(`LlamaParse poll ${i}: ${statusData.status}`);
    if (statusData.status === "SUCCESS") {
      const resultResp = await fetch(
        `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/text`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const resultData = await resultResp.json();
      return resultData.text || "";
    }
    if (statusData.status === "ERROR") {
      throw new Error("LlamaParse job failed");
    }
  }
  throw new Error("LlamaParse timeout");
}

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
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
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini embedding failed: ${err}`);
    }
    const data = await resp.json();
    embeddings.push(data.embedding.values);
  }
  return embeddings;
}

async function upsertToPinecone(
  vectors: { id: string; values: number[]; metadata: Record<string, string> }[],
  pineconeUrl: string,
  pineconeKey: string
) {
  // Batch upsert in groups of 100
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    const resp = await fetch(`${pineconeUrl}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Api-Key": pineconeKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vectors: batch }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Pinecone upsert failed: ${err}`);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LLAMA_PARSE_API_KEY = Deno.env.get("LLAMA_PARSE_API_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY")!;
    const PINECONE_INDEX_URL = Deno.env.get("PINECONE_INDEX_URL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    const fileName = file.name;

    // Create document record
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({ name: fileName, status: "processing" })
      .select()
      .single();
    if (docErr) throw docErr;

    // Parse PDF
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    let text: string;
    try {
      text = await parseWithLlamaParse(pdfBytes, LLAMA_PARSE_API_KEY);
    } catch (e) {
      await supabase.from("documents").update({ status: "error" }).eq("id", doc.id);
      throw e;
    }

    // Chunk
    const chunks = chunkText(text);

    // Embed
    const embeddings = await embedTexts(chunks, GEMINI_API_KEY);

    // Upsert to Pinecone
    const vectors = chunks.map((chunk, i) => ({
      id: `${doc.id}-${i}`,
      values: embeddings[i],
      metadata: { text: chunk, document_name: fileName, document_id: doc.id },
    }));

    await upsertToPinecone(vectors, PINECONE_INDEX_URL, PINECONE_API_KEY);

    // Update document status
    await supabase
      .from("documents")
      .update({ status: "ready", chunk_count: chunks.length, updated_at: new Date().toISOString() })
      .eq("id", doc.id);

    return new Response(
      JSON.stringify({ success: true, document_id: doc.id, chunks: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("rag-upload error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
