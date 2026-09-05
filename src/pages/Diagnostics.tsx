import React, { useState } from "react";
import PageShell from "@/components/apex/PageShell";
import { useVinDecode } from "@/hooks/useVinDecode";
import VinDecodePanel from "@/components/apex/VinDecodePanel";
import VinPremiumPanel from "@/components/apex/VinPremiumPanel";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export default function Diagnostics() {
  const urlParams = new URLSearchParams(window.location.search);
  const [vin, setVin] = useState((urlParams.get("vin") || "").toUpperCase());
  const { data, loading, error } = useVinDecode(vin);
  const valid = VIN_RE.test(vin);

  return (
    <PageShell title="VIN Diagnostics" tagline="// Deep OEM Intelligence & Triage">
      <div className="max-w-[900px] mx-auto px-6 lg:px-10 py-12">
        <div className="border border-cyan/20 bg-blueprint/30 p-5 mb-6">
          <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">
            Enter 17-character VIN
          </label>
          <div className="flex gap-2">
            <input
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
              placeholder="1G1ZC54789F1..."
              className="flex-1 bg-titanium border border-cyan/20 px-4 py-3 font-mono text-sm text-data tracking-wider focus:border-cyan focus:outline-none"
            />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            Free decode pulls NHTSA specs, recalls, complaints & NCAP ratings. A deep OEM
            diagnostic report is synthesized and unlocked per-VIN behind Base44 Payments.
          </p>
        </div>

        {valid && <VinDecodePanel data={data} loading={loading} error={error} />}

        {valid && (
          <div className="mt-6">
            <VinPremiumPanel vin={vin} />
          </div>
        )}
      </div>
    </PageShell>
  );
}