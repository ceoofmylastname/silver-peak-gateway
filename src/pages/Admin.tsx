import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type Document = {
  id: string;
  name: string;
  status: string;
  chunk_count: number;
  created_at: string;
};

const Admin = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDocuments(data as Document[]);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      alert("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Upload failed");

      await fetchDocuments();
    } catch (e) {
      console.error("Upload error:", e);
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">RAG Document Manager</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Upload PDF documents to power the Silver Peak AI assistant
            </p>
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                Parsing, embedding & indexing… this may take a minute.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop a PDF here, or click to browse
              </p>
            </div>
          )}
          <input
            id="file-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </div>

        {/* Document list */}
        {documents.length > 0 && (
          <div className="mt-8 space-y-3">
            <h2 className="text-lg font-semibold mb-4">Uploaded Documents</h2>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()} •{" "}
                    {doc.chunk_count} chunks
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  <span className="text-xs text-muted-foreground capitalize">
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
