import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { Cpu, Send, Mic, X, Loader2, Sparkles } from "lucide-react";

// --- Typed chat + voice-command boundary -------------------------------------
// These shapes govern every message exchanged between the AI assistant UI
// and the `aiService` backend function (which returns entity-aware answers),
// so a malformed payload surfaces as a compile error instead of a runtime one.
type ChatRole = "ai" | "user";

interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface VoiceCmd {
  test: RegExp;
  to: string;
}

interface AiServiceResponse {
  data?: {
    result?: string;
    error?: string;
  };
}

const QUICK: string[] = [
  "My car won't start, is it the key or the battery?",
  "Can you clone my ECU to a used one?",
  "How do I ship my instrument cluster to you?",
  "I lost all keys to my car — what's the process?",
];

const VOICE_CMDS: VoiceCmd[] = [
  { test: /\b(book|appointment|schedule)\b/i, to: "/#intake" },
  { test: /\b(services?)\b/i, to: "/services" },
  { test: /\b(contact|call|phone)\b/i, to: "/contact" },
  { test: /\b(portal|account|track|my car)\b/i, to: "/portal" },
  { test: /\b(mail|ship|send)\b/i, to: "/mail-in" },
  { test: /\b(home|start|main)\b/i, to: "/" },
  { test: /\b(dia[gn]?ose|tree|problem)\b/i, to: "/faq" },
];

// SpeechRecognition is non-standard and not in the DOM lib types.
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognition(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export default function AiAssistant() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "SKC AI online. Ask me anything — lost keys, ECU cloning, engine knock, mileage correction. I'll point you to the right service." },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const SR = getSpeechRecognition();
  const hasVoice = !!SR;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Stop any in-flight speech recognition if the assistant unmounts mid-listen.
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const send = async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = (await base44.functions.invoke("aiService", { kind: "chat", message: trimmed })) as AiServiceResponse;
      const out =
        res.data?.result ||
        "I'm having trouble answering that right now — call us at 513-568-2744.";
      setMessages((m) => [...m, { role: "ai", text: out }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: "Line noisy — call 513-568-2744 and we'll diagnose it directly." }]);
      toast({ title: "AI error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (!SR) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      setListening(false);
      const cmd = VOICE_CMDS.find((c) => c.test.test(transcript));
      if (cmd) {
        setMessages((m) => [
          ...m,
          { role: "user", text: transcript },
          { role: "ai", text: `Routing you to ${cmd.to === "/#intake" ? "the booking intake" : cmd.to}.` },
        ]);
        if (cmd.to.includes("#")) {
          if (window.location.pathname !== "/") navigate("/");
          const hash = cmd.to.split("#")[1];
          setTimeout(() => { window.location.hash = hash; }, 60);
        } else {
          navigate(cmd.to);
        }
      } else {
        send(transcript);
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div className="fixed z-50 bottom-4 left-4 print:hidden">
      {open && (
        <div className="mb-3 w-[88vw] max-w-sm bg-titanium/95 backdrop-blur-xl border border-cyan/30 glow-cyan flex flex-col" style={{ maxHeight: "70vh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan/20 bg-blueprint/60">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan" />
              <span className="font-mono text-xs uppercase tracking-widest text-cyan">SKC // AI Concierge</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-cyan"><X className="w-4 h-4" /></button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 220 }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-cyan/15 text-data border border-cyan/30" : "bg-blueprint/70 text-muted-foreground border border-cyan/10"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-cyan font-mono text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> processing…
              </div>
            )}
          </div>
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} className="font-mono text-[10px] px-2 py-1 border border-cyan/20 text-muted-foreground hover:text-cyan hover:border-cyan/50 transition-colors text-left">
                {q.length > 34 ? q.slice(0, 34) + "…" : q}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-3 border-t border-cyan/20 bg-blueprint/30">
            {hasVoice && (
              <button
                onClick={toggleVoice}
                title="Voice command"
                className={`p-2.5 border transition-all ${listening ? "border-heat bg-heat/10 text-heat animate-pulse" : "border-cyan/30 text-cyan hover:glow-cyan"}`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder={listening ? "Listening…" : "Ask the SKC AI…"}
              className="flex-1 bg-titanium border border-cyan/20 px-3 py-2.5 font-body text-sm text-data focus:border-cyan focus:outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="p-2.5 bg-cyan text-titanium disabled:opacity-30 hover:glow-cyan transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-widest px-4 py-3 hover:glow-cyan transition-all shadow-lg"
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">Ask AI</span>
        {!open && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-heat rounded-full animate-ping" />}
      </button>
    </div>
  );
}