import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-chat`;

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hey there! 👋 I'm your Silver Peak assistant. Whether you're curious about our plans, commissions, or the contracting process — I'm here to help. What's on your mind?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        const content = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > updatedMessages.length) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Hmm, something went wrong on my end. Mind trying again in a sec? 🙏",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 rounded-full shadow-2xl transition-all duration-300 ease-out ${
          open
            ? "scale-0 opacity-0 pointer-events-none"
            : "scale-100 opacity-100 hover:scale-110"
        }`}
        style={{
          width: 60,
          height: 60,
          background: "linear-gradient(135deg, hsl(205, 65%, 55%), hsl(38, 90%, 55%))",
          boxShadow: "0 8px 32px hsl(205 65% 55% / 0.4), 0 0 0 3px hsl(205 65% 55% / 0.15)",
        }}
        aria-label="Open chat"
      >
        <MessageCircle className="w-7 h-7 text-white mx-auto" />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "hsl(205, 65%, 55%)" }} />
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col transition-all duration-500 ease-out origin-bottom-right ${
          open ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        }`}
        style={{
          width: "min(420px, calc(100vw - 48px))",
          height: "min(600px, calc(100vh - 48px))",
          borderRadius: "1.5rem",
          background: "linear-gradient(145deg, hsl(210 30% 12% / 0.85), hsl(210 30% 8% / 0.92))",
          backdropFilter: "blur(40px) saturate(1.4)",
          WebkitBackdropFilter: "blur(40px) saturate(1.4)",
          border: "1px solid hsl(205 65% 55% / 0.2)",
          boxShadow:
            "0 25px 60px -12px hsl(210 30% 4% / 0.7), 0 0 80px -20px hsl(205 65% 55% / 0.15), inset 0 1px 0 hsl(210 20% 95% / 0.05)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{
            borderBottom: "1px solid hsl(210 20% 20% / 0.6)",
            borderRadius: "1.5rem 1.5rem 0 0",
            background: "linear-gradient(180deg, hsl(210 30% 14% / 0.5), transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(205, 65%, 55%), hsl(38, 90%, 55%))",
                boxShadow: "0 4px 12px hsl(205 65% 55% / 0.3)",
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">Silver Peak AI</h3>
              <p className="text-[11px] text-muted-foreground">Ask me anything</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-2xl rounded-br-md"
                    : "rounded-2xl rounded-bl-md"
                }`}
                style={
                  msg.role === "user"
                    ? {
                        background: "linear-gradient(135deg, hsl(205, 65%, 55%), hsl(220, 70%, 50%))",
                        color: "white",
                        boxShadow: "0 4px 15px hsl(205 65% 55% / 0.25)",
                      }
                    : {
                        background: "hsl(210 25% 16% / 0.8)",
                        border: "1px solid hsl(210 20% 22% / 0.5)",
                        color: "hsl(210 20% 90%)",
                      }
                }
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div
                className="px-4 py-3 rounded-2xl rounded-bl-md"
                style={{
                  background: "hsl(210 25% 16% / 0.8)",
                  border: "1px solid hsl(210 20% 22% / 0.5)",
                }}
              >
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid hsl(210 20% 20% / 0.6)" }}>
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2"
            style={{
              background: "hsl(210 25% 14% / 0.8)",
              border: "1px solid hsl(210 20% 22% / 0.5)",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask about Silver Peak..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              disabled={isLoading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: input.trim()
                  ? "linear-gradient(135deg, hsl(205, 65%, 55%), hsl(38, 90%, 55%))"
                  : "transparent",
              }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-50">
            Powered by Silver Peak AI
          </p>
        </div>
      </div>
    </>
  );
};

export default ChatWidget;
