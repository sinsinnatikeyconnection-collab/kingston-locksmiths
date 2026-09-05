import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    return () => window.removeEventListener("beforeinstallprompt", onBefore);
  }, []);

  if (!show || !evt) return null;

  const install = async () => {
    evt.prompt();
    await evt.userChoice;
    setShow(false);
    setEvt(null);
  };

  return (
    <div className="fixed z-50 bottom-20 sm:bottom-4 right-4 max-w-[18rem] bg-titanium/95 backdrop-blur-xl border border-cyan/30 glow-cyan p-4">
      <button onClick={() => setShow(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-cyan">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Download className="w-4 h-4 text-cyan" />
        <span className="font-mono text-xs uppercase tracking-wider text-cyan">Install App</span>
      </div>
      <p className="font-body text-xs text-muted-foreground mb-3 leading-relaxed">
        Add SKC to your home screen for status push notifications on your bookings & mail-in repairs.
      </p>
      <button onClick={install} className="w-full bg-cyan text-titanium font-mono text-xs uppercase tracking-wider py-2.5 hover:glow-cyan">
        Install to Home Screen
      </button>
    </div>
  );
}