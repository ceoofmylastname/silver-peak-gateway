import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { carrier: string; section: string; score: number }[];
};

const QUICK_PROMPTS = [
  "What carriers do you offer?",
  "How do I get appointed?",
  "What are the commission rates?",
  "What makes Silver Peak different?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/underwriting-chat`;

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
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
        body: JSON.stringify({
          question: text.trim(),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Failed to connect");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let sources: Message["sources"] = [];

      const upsertAssistant = (nextChunk: string, newSources?: Message["sources"]) => {
        assistantSoFar += nextChunk;
        const currentSources = newSources || sources;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: assistantSoFar, sources: currentSources }
                : m
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar, sources: currentSources }];
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
            if (parsed.sources) {
              sources = parsed.sources;
              upsertAssistant("", sources);
            } else {
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) upsertAssistant(content);
            }
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
          content:
            "I'm having trouble connecting right now. Please try again in a moment, or fill out the Appointment & Readiness Survey on the page for personalized help!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Open chat"
        >
          <div className="relative">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-accent/40 blur-lg animate-pulse group-hover:bg-accent/60 transition-all" />
            {/* Button */}
            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-xl shadow-accent/30 hover:shadow-accent/50 hover:scale-110 transition-all duration-300">
              <MessageCircle className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-4rem)] flex flex-col rounded-3xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{
            background: "linear-gradient(135deg, hsl(210 30% 10% / 0.85), hsl(210 25% 14% / 0.9))",
            backdropFilter: "blur(40px) saturate(1.5)",
            WebkitBackdropFilter: "blur(40px) saturate(1.5)",
            border: "1px solid hsl(210 20% 25% / 0.5)",
            boxShadow:
              "0 25px 60px -15px hsl(210 30% 5% / 0.7), 0 0 40px -10px hsl(38 90% 55% / 0.15), inset 0 1px 0 0 hsl(210 20% 30% / 0.3)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "hsl(210 20% 22% / 0.6)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg shadow-accent/20">
                <Sparkles className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Silver Peak AI</h3>
                <p className="text-[11px] text-muted-foreground">Agent Support Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Hey there! 👋
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[250px]">
                    I'm your Silver Peak assistant. Ask me anything about our plans, appointments, or commissions.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-[11px] px-3 py-1.5 rounded-full border transition-all hover:scale-105"
                      style={{
                        borderColor: "hsl(210 20% 25% / 0.6)",
                        background: "hsl(210 25% 14% / 0.5)",
                        color: "hsl(210 20% 80%)",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-md"
                      : "rounded-bl-md"
                  }`}
                  style={
                    msg.role === "user"
                      ? {
                          background: "linear-gradient(135deg, hsl(38 90% 55%), hsl(28 85% 50%))",
                          color: "hsl(210 30% 8%)",
                        }
                      : {
                          background: "hsl(210 22% 16% / 0.8)",
                          border: "1px solid hsl(210 20% 22% / 0.5)",
                          color: "hsl(210 20% 90%)",
                        }
                  }
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>p:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}

                  {/* Source citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: "1px solid hsl(210 20% 25% / 0.4)" }}>
                      {msg.sources.map((s, j) => (
                        <span
                          key={j}
                          className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: "hsl(205 65% 55% / 0.15)",
                            color: "hsl(205 65% 65%)",
                            border: "1px solid hsl(205 65% 55% / 0.2)",
                          }}
                        >
                          {s.carrier} — {s.section}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5"
                  style={{
                    background: "hsl(210 22% 16% / 0.8)",
                    border: "1px solid hsl(210 20% 22% / 0.5)",
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
              style={{
                background: "hsl(210 22% 14% / 0.8)",
                border: "1px solid hsl(210 20% 22% / 0.5)",
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Silver Peak..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                style={{
                  background: input.trim()
                    ? "linear-gradient(135deg, hsl(38 90% 55%), hsl(28 85% 50%))"
                    : "transparent",
                }}
              >
                <Send
                  className="w-4 h-4"
                  style={{ color: input.trim() ? "hsl(210 30% 8%)" : "hsl(210 12% 55%)" }}
                />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
