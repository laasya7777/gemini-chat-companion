import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, PanelLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import ChatSidebar, { ChatSession } from "@/components/ChatSidebar";
import { Message, streamChat } from "@/lib/streamChat";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeMessages = activeSessionId ? messagesBySession[activeSessionId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  const createSession = useCallback((title: string) => {
    const id = crypto.randomUUID();
    const session: ChatSession = { id, title, createdAt: new Date() };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(id);
    setMessagesBySession((prev) => ({ ...prev, [id]: [] }));
    return id;
  }, []);

  const handleSend = useCallback(async (input: string) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createSession(input.slice(0, 40));
    }

    const userMsg: Message = { role: "user", content: input };
    setMessagesBySession((prev) => ({
      ...prev,
      [sessionId!]: [...(prev[sessionId!] || []), userMsg],
    }));
    setIsLoading(true);

    let assistantContent = "";

    await streamChat({
      messages: [...(messagesBySession[sessionId] || []), userMsg],
      onDelta: (chunk) => {
        assistantContent += chunk;
        const current = assistantContent;
        setMessagesBySession((prev) => {
          const msgs = prev[sessionId!] || [];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            return { ...prev, [sessionId!]: msgs.map((m, i) => i === msgs.length - 1 ? { ...m, content: current } : m) };
          }
          return { ...prev, [sessionId!]: [...msgs, { role: "assistant", content: current }] };
        });
      },
      onDone: () => setIsLoading(false),
      onError: (err) => {
        toast.error(err);
        setIsLoading(false);
      },
    });
  }, [activeSessionId, messagesBySession, createSession]);

  const handleNewChat = () => {
    setActiveSessionId(null);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setMessagesBySession((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeSessionId === id) setActiveSessionId(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isMobile ? "100%" : 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 overflow-hidden border-r border-border h-full"
            style={{ position: isMobile ? "absolute" : "relative", zIndex: isMobile ? 50 : 1 }}
          >
            <ChatSidebar
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={(id) => {
                setActiveSessionId(id);
                if (isMobile) setSidebarOpen(false);
              }}
              onNew={() => {
                handleNewChat();
                if (isMobile) setSidebarOpen(false);
              }}
              onDelete={handleDeleteSession}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <PanelLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Gemini</h1>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>
              <h2 className="text-2xl font-semibold text-foreground">How can I help you today?</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Ask me anything — I can help with writing, analysis, coding, math, and much more.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 max-w-lg w-full">
                {[
                  "Explain quantum computing simply",
                  "Write a Python sorting algorithm",
                  "Help me plan a trip to Japan",
                  "Summarize the latest AI trends",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-4 py-3 text-sm text-left rounded-xl border border-border bg-card text-card-foreground hover:bg-accent transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {activeMessages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
              {isLoading && activeMessages[activeMessages.length - 1]?.role === "user" && (
                <div className="flex gap-3 py-4 px-4 md:px-8">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Index;
