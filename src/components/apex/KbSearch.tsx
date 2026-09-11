import db from "@/api/apiClient";

import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Search, ChevronDown, Sparkles, Loader2, Cpu } from "lucide-react";

type Category = "Lost Keys & Security" | "Electrical & Diagnostics" | "Performance & Tuning" | "Mail-In Service" | "Pricing & Warranty";

interface KbArticle {
  id?: string;
  question: string;
  answer: string;
  category: Category;
  order?: number;
}

const FALLBACK: KbArticle[] = [
  {
    question: "I lost all my keys. Can you make a new one without the original?",
    answer: "Yes. We perform **all-keys-lost generation** — we read the immobilizer PIN via OBD2 or pull the EEPROM/MCU directly off the board, then cut a fresh blade and program a new transponder or smart key. Most vehicles are running again the same day, on-site or at the shop.",
    category: "Lost Keys & Security",
    order: 1,
  },
  {
    question: "Can you bypass the immobilizer after a battery swap killed my car?",
    answer: "Yes — a common BCM/immobilizer desync after a dead battery. We re-synchronize the IMMO and key via OBD2, or reset the immobilizer data and re-pair the fob. If the BCM is corrupt we can **clone or replace** it. No dealer tow required.",
    category: "Lost Keys & Security",
    order: 2,
  },
  {
    question: "Do you clone an ECU to a used replacement module?",
    answer: "Yes. We read the donor ECU's software, immobilizer, and configuration, then **clone it onto the replacement** (or virginize the donor and adapt it to your car) so the vehicle accepts it without a dealer visit. Covers engine, transmission, and body control modules.",
    category: "Electrical & Diagnostics",
    order: 3,
  },
  {
    question: "My car has a parasitic draw. How do you find it?",
    answer: "We use a current-clamp and voltage-drop method to isolate the draw to the exact fuse or module — often a stuck relay, aftermarket alarm, or a CAN bus that won't sleep. We then repair the fault instead of just disconnecting things.",
    category: "Electrical & Diagnostics",
    order: 4,
  },
  {
    question: "Will a performance tune hurt my engine?",
    answer: "Not when it's done right. Every remap is **datalogged before and after** and tuned for your fuel, boost, and mods. We keep torque within safe limits and show you the numbers. Honest, data-backed tuning — not a generic flash.",
    category: "Performance & Tuning",
    order: 5,
  },
  {
    question: "How does the mail-in service work?",
    answer: "1) Request a label from the Mail-In page.\n2) We generate a **blind shipping label** (destination masked) and email it to you.\n3) Ship the part — cluster, ECU, keys, or module.\n4) We diagnose, repair/clone, and ship it back with tracking.\nYou keep your vehicle the whole time.",
    category: "Mail-In Service",
    order: 6,
  },
  {
    question: "Can you correct the mileage on a replaced cluster?",
    answer: "Yes. We read the MCU data on the original and new cluster, write the correct mileage, and flash it back directly to the MCU so it matches. Done as part of a cluster swap or ECU/cluster replacement.",
    category: "Electrical & Diagnostics",
    order: 7,
  },
  {
    question: "How much does it cost and is there a warranty?",
    answer: "Pricing depends on the vehicle and service — key generation, ECU clone, and tuning are quoted up front. Most work is backed by a **service certificate** with the technician, VIN, and mileage logged, viewable anytime in your Portal.",
    category: "Pricing & Warranty",
    order: 8,
  },
];

const MD: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  strong: ({ children }) => <strong className="text-cyan font-semibold">{children}</strong>,
  code: ({ children }) => <code className="font-mono text-[11px] text-cyan/80 bg-titanium px-1">{children}</code>,
};

export default function KbSearch() {
  const [articles, setArticles] = useState<KbArticle[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [ai, setAi] = useState<{ loading: boolean; text: string | null; error: string | null }>({ loading: false, text: null, error: null });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await db.entities.KbArticle.list("order", 100);
        if (active) setArticles(list && list.length ? (list as KbArticle[]) : FALLBACK);
      } catch {
        if (active) setArticles(FALLBACK);
      }
    })();
    return () => { active = false; };
  }, []);

  const list = articles || FALLBACK;

  const categories = useMemo(() => {
    const set = new Set<Category>(list.map((a) => a.category));
    return ["All", ...Array.from(set)] as (Category | "All")[];
  }, [list]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((a) => {
      if (cat !== "All" && a.category !== cat) return false;
      if (!term) return true;
      return (a.question + " " + a.answer + " " + a.category).toLowerCase().includes(term);
    });
  }, [list, q, cat]);

  const askAi = async () => {
    const term = q.trim();
    if (!term || ai.loading) return;
    setAi({ loading: true, text: null, error: null });
    try {
      const res = (await db.functions.invoke("aiService", { kind: "chat", message: term, history: [] })) as { data?: { result?: string; error?: string } };
      const out = res.data?.result || "I couldn't pull an answer right now — call 513-568-2744.";
      setAi({ loading: false, text: out, error: null });
    } catch (e) {
      setAi({ loading: false, text: null, error: (e as Error).message });
    }
  };

  return (
    <div className="w-full">
      {/* search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the knowledge base…"
            className="w-full bg-titanium border border-cyan/30 pl-10 pr-3 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none"
          />
        </div>
        <button
          onClick={askAi}
          disabled={!q.trim() || ai.loading}
          className="flex items-center justify-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-5 py-3 hover:glow-cyan transition-all disabled:opacity-40"
        >
          {ai.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Ask the AI
        </button>
      </div>

      {/* category chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-all ${
              cat === c ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/20 text-muted-foreground hover:text-cyan hover:border-cyan/50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* AI answer */}
      {ai.loading && (
        <div className="flex items-center gap-2 text-cyan font-mono text-xs mb-6"><Loader2 className="w-3 h-3 animate-spin" /> AI is answering…</div>
      )}
      {ai.text && (
        <div className="mb-8 border border-cyan/30 glow-cyan bg-blueprint/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-cyan" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan">SKC AI // Answer</span>
          </div>
          <div className="font-body text-sm text-data/90 leading-relaxed">
            <ReactMarkdown components={MD}>{ai.text}</ReactMarkdown>
          </div>
        </div>
      )}
      {ai.error && (
        <div className="mb-8 border border-heat/40 text-heat font-mono text-xs p-4">AI error: {ai.error}</div>
      )}

      {/* results */}
      <div className="border border-cyan/10">
        {filtered.length === 0 ? (
          <div className="p-8 text-center font-body text-sm text-muted-foreground">
            No articles match. Try another term, or hit <span className="text-cyan">Ask the AI</span>.
          </div>
        ) : (
          filtered.map((a, i) => {
            const id = a.id || String(i);
            const open = openId === id;
            return (
              <div key={id} className="border-b border-cyan/10 last:border-b-0">
                <button
                  onClick={() => setOpenId(open ? null : id)}
                  className="flex items-center justify-between w-full text-left px-5 py-4 hover:bg-blueprint/40 transition-colors"
                >
                  <span className="font-body text-sm text-data pr-3">{a.question}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-cyan/60 hidden sm:inline">{a.category}</span>
                    <ChevronDown className={`w-4 h-4 text-cyan transition-transform ${open ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-5 font-body text-sm text-muted-foreground leading-relaxed">
                    <ReactMarkdown components={MD}>{a.answer}</ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {filtered.length} article{filtered.length === 1 ? "" : "s"} · Curated by SKC technicians · Ask the AI for anything not listed.
      </p>
    </div>
  );
}