import db from "@/api/base44Client";

import React, { useState } from "react";
import { Loader2, Send, Check } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { validateEmail, validateNonEmpty } from "@/lib/validation";

// Public contact form on /contact. Submits to the ContactMessage entity
// (open create, admin-only read) and shows an inline confirmation state.
export default function ContactForm() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const nR = validateNonEmpty("Name", form.name);
    const eR = validateEmail(form.email);
    const mR = validateNonEmpty("Message", form.message);
    if (!nR.ok) { setErr(nR.error); return; }
    if (!eR.ok) { setErr(eR.error); return; }
    if (!mR.ok) { setErr(mR.error); return; }
    setBusy(true);
    try {
      const created = await db.entities.ContactMessage.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
        status: "new",
      } as any);
      try { await db.functions.invoke("notifyContact", { messageId: created.id }); } catch (_e) { /* best-effort; message already saved */ }
      setDone(true);
      toast({ title: "Message sent", description: "A technician will reach out shortly." });
    } catch (e: any) {
      setErr(e?.message || "Could not send. Please call us instead.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="border border-cyan/30 bg-cyan/5 p-6 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-cyan text-titanium flex items-center justify-center mb-3">
          <Check className="w-5 h-5" />
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-2">// Message Received</div>
        <p className="font-body text-sm text-muted-foreground">
          Thanks, {form.name.split(" ")[0] || "there"}. We've logged your message and a technician will respond shortly.
        </p>
        <button
          onClick={() => { setDone(false); setForm({ name: "", email: "", phone: "", message: "" }); }}
          className="mt-4 font-mono text-[11px] uppercase text-cyan underline underline-offset-4"
        >
          Send another
        </button>
      </div>
    );
  }

  const inputCls = "w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <input
          placeholder="Your name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputCls}
          aria-label="Name"
        />
        <input
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={inputCls}
          aria-label="Phone"
        />
      </div>
      <input
        type="email"
        placeholder="Your email *"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className={inputCls}
        aria-label="Email"
      />
      <textarea
        placeholder="What do you need help with? *"
        rows={4}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className={`${inputCls} resize-none`}
        aria-label="Message"
      />
      {err && <p className="font-mono text-[11px] text-heat">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-6 py-3 hover:glow-cyan disabled:opacity-50 transition-all"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
      </button>
    </form>
  );
}