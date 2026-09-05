import { useLocation, Link } from 'react-router-dom';
import { Cpu, ChevronLeft } from 'lucide-react';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-titanium circuit-grid">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 border border-cyan/40 mb-6">
          <Cpu className="w-7 h-7 text-cyan" />
        </div>
        <h1 className="font-heading text-7xl text-data leading-none mb-3">404</h1>
        <div className="h-px w-16 bg-cyan mx-auto mb-6" />
        <h2 className="font-mono text-sm uppercase tracking-widest text-cyan mb-2">// Signal Lost</h2>
        <p className="font-body text-sm text-muted-foreground mb-8">
          The route <span className="font-mono text-data">/{pageName || "unknown"}</span> is not part of this system.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-6 py-3 hover:glow-cyan transition-all">
          <ChevronLeft className="w-4 h-4" /> Return to Base
        </Link>
      </div>
    </div>
  );
}