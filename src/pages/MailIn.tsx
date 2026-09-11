import db from "@/api/apiClient";

import React, { useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import PageShell from "@/components/apex/PageShell";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { Loader2, Truck, CheckCircle2, ShieldCheck, Package } from "lucide-react";
import type { MailInItemType, MailInRequest, MailInStatus } from "@/lib/types";
import { newIdempotencyKey, loadIdempotencyKey, persistIdempotencyKey, clearIdempotencyKey } from "@/lib/idempotency";
import { validateEmail, validateNonEmpty, validateMinLength } from "@/lib/validation";
import { safeInvoke } from "@/lib/safeInvoke";

const ITEMS: MailInItemType[] = ["Instrument Cluster", "ECU / Module", "Keys / Fobs", "Engine / Long Block", "Transmission", "Wheels / Tires", "Full Vehicle / Pickup", "Other"];

interface MailInForm {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  item_type: MailInItemType;
  vehicle: string;
  problem: string;
}

interface LabelResult {
  status?: MailInStatus | string;
  tracking?: string;
  label?: string;
}

export default function MailIn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<MailInForm>({
    customer_name: user?.full_name || "",
    customer_email: user?.email || "",
    customer_phone: "",
    item_type: "ECU / Module",
    vehicle: "",
    problem: "",
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<LabelResult | null>(null);

  const submit = async () => {
    if (!form.customer_email || !form.vehicle || form.problem.length < 6) {
      toast({ title: "Missing info", description: "Email, vehicle, and a short problem are required.", variant: "destructive" });
      return;
    }
    // Malformed-input guards — reject before any network call.
    const emailR = validateEmail(form.customer_email);
    if (!emailR.ok) { toast({ title: "Invalid email", description: emailR.error, variant: "destructive" }); return; }
    const vehicleR = validateNonEmpty("Vehicle", form.vehicle);
    if (!vehicleR.ok) { toast({ title: "Missing info", description: vehicleR.error, variant: "destructive" }); return; }
    const problemR = validateMinLength("Problem", form.problem, 6);
    if (!problemR.ok) { toast({ title: "Missing info", description: problemR.error, variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      let key = loadIdempotencyKey("mailin");
      if (!key) {
        key = newIdempotencyKey();
        persistIdempotencyKey("mailin", key);
      }
      const result = await safeInvoke(() => db.functions.invoke("createMailIn", {
        idempotencyKey: key,
        request: {
          ...form,
          customer_email: user?.email || form.customer_email,
          customer_name: form.customer_name || "—",
        },
      }));
      if (!result.ok) {
        toast({
          title: result.retryable ? "Network interrupted" : "Submission failed",
          description: result.error,
          variant: "destructive",
        });
        return; // keep key for retry; server collapses it
      }
      if (!result.value?.data?.labelResult) {
        toast({ title: "Submission failed", description: "No response from server.", variant: "destructive" });
        return;
      }
      setResult(result.value.data.labelResult || { status: "pending" });
      clearIdempotencyKey("mailin");
      toast({ title: "Mail-in request received", description: "Check below for your label." });
    } catch (e) {
      toast({ title: "Submission failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="Mail-In Service Portal" tagline="// Ship Modules, Clusters & Keys">
      <div className="max-w-[1000px] mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-center gap-3 mb-6 border border-cyan/20 bg-blueprint/30 p-5">
          <ShieldCheck className="w-5 h-5 text-cyan" />
          <p className="font-body text-sm text-muted-foreground">
            Ship us your instrument cluster, ECU/BCM, or keys for cloning, programming, or repair. When you generate a
            label, your prepaid secure routing goes to our Cincinnati logistics hub — you see a tracking number and
            routing hub only. We email your technician immediately.
          </p>
        </div>

        {!result ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="border border-cyan/20 bg-blueprint/30 p-6 space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-widest text-cyan">// Service Request</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Name" value={form.customer_name} onChange={(v) => setForm({ ...form, customer_name: v })} />
                <Input label="Email" value={form.customer_email} onChange={(v) => setForm({ ...form, customer_email: v })} type="email" />
                <Input label="Phone" value={form.customer_phone} onChange={(v) => setForm({ ...form, customer_phone: v })} />
                <Input label="Vehicle (year/make/model)" value={form.vehicle} onChange={(v) => setForm({ ...form, vehicle: v })} />
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2">What are you shipping?</div>
                <div className="grid grid-cols-2 gap-2">
                  {ITEMS.map((it) => (
                    <button key={it} onClick={() => setForm({ ...form, item_type: it })} className={`py-2.5 border font-mono text-xs transition-all ${form.item_type === it ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"}`}>
                      {it}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2">Describe the problem / service needed</div>
                <textarea value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} rows={4} placeholder="e.g. Cluster dead, mileage needs calibration to 84,200 after engine swap…" className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none resize-none" />
              </div>
              <button onClick={submit} disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3.5 hover:glow-cyan disabled:opacity-50">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating secure label…</> : <><Truck className="w-4 h-4" /> Request Secure Prepaid Label</>}
              </button>
            </div>

            <div className="border border-cyan/20 p-6">
              <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-4">// How Mail-In Works</div>
              <ol className="space-y-4">
                {([
                  ["Pack it securely", "Box your cluster/module/keys in anti-static wrap."],
                  ["Generate a label", "We create a tracked, prepaid shipping label to our Cincinnati hub — routing shown, address hidden on-screen."],
                  ["We receive & flash", "On arrival we clone/program/repair and email you a digital certificate."],
                  ["Return shipped", "Tracked return to your door."],
                ] as [string, string][]).map(([t, d], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-mono text-cyan text-sm">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="font-mono text-sm text-data">{t}</div>
                      <div className="font-body text-xs text-muted-foreground">{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="max-w-xl mx-auto border border-cyan/20 bg-blueprint/30 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-cyan mx-auto mb-4 drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]" />
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-2">Mail-In Confirmed</div>
            <h3 className="font-heading text-2xl uppercase text-data mb-5">Request Logged</h3>
            <div className="border border-cyan/20 bg-titanium p-4 text-left space-y-2 mb-5">
              <div className="font-mono text-[11px] text-muted-foreground">▸ Routing Hub: <span className="text-cyan">SKC Secure Receiving — Cincinnati, OH</span></div>
              <div className="font-mono text-[11px] text-muted-foreground">▸ Service: {form.item_type} — {form.vehicle}</div>
              {result.tracking && <div className="font-mono text-[11px] text-muted-foreground">▸ Tracking: <span className="text-data">{result.tracking}</span></div>}
              <div className="font-mono text-[11px] text-muted-foreground">▸ Status: {result.status === "label_ready" ? "Prepaid label ready" : "Label being generated — emailed shortly"}</div>
            </div>
            {result.label ? (
              <a href={result.label} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-cyan">
                <Package className="w-4 h-4" /> Print Prepaid Label
              </a>
            ) : (
              <p className="font-mono text-[11px] text-muted-foreground">Your prepaid label will be emailed to {form.customer_email} shortly.</p>
            )}
            <div className="mt-6">
              <Link to="/portal" className="font-mono text-xs uppercase text-cyan hover:underline">View in your portal →</Link>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email";
}
function Input({ label, value, onChange, type = "text" }: InputProps) {
  return (
    <div>
      <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-titanium border border-cyan/20 px-4 py-2.5 font-body text-sm text-data focus:border-cyan focus:outline-none" />
    </div>
  );
}