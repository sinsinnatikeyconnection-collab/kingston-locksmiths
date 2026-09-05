import db from "@/api/base44Client";

import React, { useState, useRef, useEffect } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import { Cpu, Send, Mic, X, Loader2, Sparkles, Car, Stethoscope } from "lucide-react";
import DiagnosticCard, { type DiagnosticResult } from "@/components/apex/DiagnosticCard";

// Enhanced AI diagnostic concierge:
// - vehicle-aware (paste a VIN → NHTSA decode → answers tailored to platform)
// - short conversation memory (last 6 turns sent to the backend)
// - markdown replies
// - structured "run a symptom diagnostic" card (cause/confidence/category/CTA)
// - voice commands (unchanged)

type ChatRole = "ai" | "user";

interface ChatMessage {
  role: ChatRole;
  text: string;
  diagnostic?: DiagnosticResult;
}

interface VehicleCtx {
  vin: string;
  label: string;
}

interface AiChatResponse {
  data?: { result?: string; error?: string };
}
interface AiDiagResponse {
  data?: { result?: DiagnosticResult; error?: string };
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

const QUICK: string[] = [
  "My car won't start — is it the key or the battery?",
  "I lost all keys to my car — what's the process?",
  "How do I ship my instrument cluster to you?",
  "Can you clone my ECU to a used one?",
];

const VOICE_CMDS: { test: RegExp; to: string }[] = [
  { test: /\b(book|appointment|schedule)\b/i, to: "/#intake" },
  { test: /\b(services?)\b/i, to: "/services" },
  { test: /\b(contact|call|phone)\b/i, to: "/contact" },
  { test: /\b(portal|account|track|my car)\b/i, to: "/portal" },
  { test: /\b(mail|ship|send)\b/i, to: "/mail-in" },
  { test: /\b(home|start|main)\b/i, to: "/" },
  { test: /\b(diagnos|tree|problem|symptom)\b/i, to: "/diagnostics" },
];

const MD_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="text-cyan font-semibold">{children}</strong>,
  code: ({ children }) => <code className="font-mono text-[11px] text-cyan/80 bg-titanium px-1">{children}</code>,
};

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
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export default function AiAssistant() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "SKC AI online. Tell me your symptom or ask anything — lost keys, ECU cloning, engine knock, mileage correction. I'll point you to the right service. Tip: tap the car icon to lock answers to your exact vehicle." },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [vehicle, setVehicle] = useState<VehicleCtx | null>(null);
  const [vinDraft, setVinDraft] = useState<string>("");
  const [vinOpen, setVinOpen] = useState<boolean>(false);
  const [vinBusy, setVinBusy] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const SR = getSpeechRecognition();
  const hasVoice = !!SR;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const historyPayload = (): { role: ChatRole; text: string }[] =>
    messages.filter((m) => m.text.trim()).slice(-6).map((m) => ({ role: m.role, text: m.text }));

  const decodeVin = async () => {
    const vin = vinDraft.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
    if (!VIN_RE.test(vin)) {
      toast({ title: "VIN must be 17 chars (no I/O/Q)", variant: "destructive" });
      return;
    }
    setVinBusy(true);
    try {
      const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
      if (!r.ok) throw new Error("decode failed");
      const j = await r.json();
      const pick = (n: string) => (j.Results || []).find((x: { Variable: string; Value: string }) => x.Variable === n)?.Value || "";
      const label = [pick("Model Year"), pick("Make"), pick("Model")].filter(Boolean).join(" ");
      if (!label) { toast({ title: "Couldn't decode that VIN", variant: "destructive" }); return; }
      setVehicle({ vin, label });
      setVinOpen(false);
      setVinDraft("");
    } catch {
      toast({ title: "VIN decode failed", variant: "destructive" });
    } finally {
      setVinBusy(false);
    }
  };

  const send = async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = (await db.functions.invoke("aiService", { kind: "chat", message: trimmed, vehicle: vehicle?.label, history: historyPayload() })) as AiChatResponse;
      const out = res.data?.result || "I'm having trouble answering that right now — call us at 513-568-2744.";
      setMessages((m) => [...m, { role: "ai", text: out }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: "Line noisy — call 513-568-2744 and we'll diagnose it directly." }]);
      toast({ title: "AI error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async (symptoms?: string) => {
    const s = (symptoms || input).trim();
    if (!s) { toast({ title: "Type your symptom first", variant: "destructive" }); return; }
    if (loading) return;
    setMessages((m) => [...m, { role: "user", text: s }]);
    setInput("");
    setLoading(true);
    try {
      const res = (await db.functions.invoke("aiService", { kind: "diagnostic", symptoms: s, vehicle: vehicle?.label })) as AiDiagResponse;
      const d = res.data?.result;
      if (d && d.cause && d.category) {
        setMessages((m) => [...m, { role: "ai", text: "", diagnostic: d }]);
      } else {
        setMessages((m) => [...m, { role: "ai", text: "I couldn't run that diagnostic right now — call 513-568-2744 and we'll walk through it live." }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: "Diagnostic engine offline — call 513-568-2744 for a live tech." }]);
      toast({ title: "AI error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (!SR) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      setListening(false);
      const cmd = VOICE_CMDS.find((c) => c.test.test(transcript));
      if (cmd) {
        setMessages((m) => [...m, { role: "user", text: transcript }, { role: "ai", text: `Routing you to ${cmd.to === "/#intake" ? "the booking intake" : cmd.to}.` }]);
        if (cmd.to.includes("#")) {
          if (window.location.pathname !== "/") navigate("/");
          const hash = cmd.to.split("#")[1];
          setTimeout(() => { window.location.hash = hash; }, 60);
        } else navigate(cmd.to);
      } else send(transcript);
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
        <div className="mb-3 w-[90vw] max-w-sm bg-titanium/95 backdrop-blur-xl border border-cyan/30 glow-cyan flex flex-col" style={{ maxHeight: "74vh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan/20 bg-blueprint/60">
            <div className="flex items-center gap-2 min-w-0">
              <Cpu className="w-4 h-4 text-cyan shrink-0" />
              <span className="font-mono text-xs uppercase tracking-widest text-cyan truncate">SKC // AI Concierge</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setVinOpen((v) => !v)} title="Set vehicle context" className={`p-1.5 border transition-all ${vehicle ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}>
                <Car className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-cyan"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {vehicle && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-cyan/5 border-b border-cyan/10">
              <span className="font-mono text-[9px] uppercase tracking-widest text-cyan/60 shrink-0">// Vehicle</span>
              <span className="font-mono text-[11px] text-cyan truncate">{vehicle.label}</span>
              <button onClick={() => setVehicle(null)} className="ml-auto text-muted-foreground hover:text-heat"><X className="w-3 h-3" /></button>
            </div>
          )}

          {vinOpen && (
            <div className="flex gap-2 px-4 py-2.5 border-b border-cyan/10 bg-blueprint/40">
              <input
                value={vinDraft}
                onChange={(e) => setVinDraft(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
                onKeyDown={(e) => e.key === "Enter" && decodeVin()}
                placeholder="17-char VIN"
                className="flex-1 bg-titanium border border-cyan/20 px-2.5 py-2 font-mono text-xs text-data focus:border-cyan focus:outline-none"
              />
              <button onClick={decodeVin} disabled={vinBusy} className="font-mono text-[10px] uppercase tracking-wider bg-cyan text-titanium px-3 py-2 hover:glow-cyan disabled:opacity-50">
                {vinBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Set"}
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 220 }}>
            {messages.map((m, i) => m.diagnostic ? (
              <div key={i} className="flex justify-start"><div className="max-w-[90%]"><DiagnosticCard d={m.diagnostic} /></div></div>
            ) : (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-cyan/15 text-data border border-cyan/30" : "bg-blueprint/70 text-muted-foreground border border-cyan/10"}`}>
                  {m.role === "ai" ? <ReactMarkdown components={MD_COMPONENTS}>{m.text}</ReactMarkdown> : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-cyan font-mono text-xs"><Loader2 className="w-3 h-3 animate-spin" /> processing…</div>
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
              <button onClick={toggleVoice} title="Voice command" className={`p-2.5 border transition-all ${listening ? "border-heat bg-heat/10 text-heat animate-pulse" : "border-cyan/30 text-cyan hover:glow-cyan"}`}>
                <Mic className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => runDiagnostic(input)} title="Run a symptom diagnostic" className="p-2.5 border border-cyan/30 text-cyan hover:glow-cyan transition-all">
              <Stethoscope className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder={listening ? "Listening…" : "Ask the SKC AI…"}
              className="flex-1 bg-titanium border border-cyan/20 px-3 py-2.5 font-body text-sm text-data focus:border-cyan focus:outline-none"
            />
            <button onClick={() => send(input)} disabled={loading || !input.trim()} className="p-2.5 bg-cyan text-titanium disabled:opacity-30 hover:glow-cyan transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="relative flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-widest px-4 py-3 hover:glow-cyan transition-all shadow-lg">
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">Ask AI</span>
        {!open && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-heat rounded-full animate-ping" />}
      </button>
    </div>
  );
}