

# Ensure PDF Upload Works with Pinecone

## Summary
The RAG upload pipeline is already built and configured. The only action needed is to verify the `PINECONE_INDEX_URL` secret matches the URL you provided, then test the upload.

## Steps

### 1. Update the PINECONE_INDEX_URL secret
Set the `PINECONE_INDEX_URL` secret to the exact value from your Pinecone dashboard:
```
https://silverpeak-rv7l8s6.svc.aped-4627-b74a.pinecone.io
```
This ensures the edge function connects to the correct index. The secret already exists but we'll confirm/update its value.

### 2. Verify the pipeline end-to-end
No code changes needed — the existing flow is:
1. Admin uploads PDF on `/admin` page
2. `rag-upload` edge function receives the file
3. LlamaParse extracts text from PDF
4. Text is chunked (1500 chars, 200 overlap)
5. Chunks are embedded with Gemini (`gemini-embedding-001`, 768 dimensions — matches your Pinecone index)
6. Vectors are upserted to Pinecone
7. Document status updated to "ready" in the database

### Technical Notes
- Pinecone index: 768 dimensions, cosine metric, dense — all compatible with current code
- All secrets already configured: `PINECONE_API_KEY`, `PINECONE_INDEX_URL`, `LLAMA_PARSE_API_KEY`, `GEMINI_API_KEY`
- The only potential issue: confirming the `PINECONE_INDEX_URL` secret value is exactly `https://silverpeak-rv7l8s6.svc.aped-4627-b74a.pinecone.io`

