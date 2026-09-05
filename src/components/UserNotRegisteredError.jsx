import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const UserNotRegisteredError = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-titanium circuit-grid p-6">
      <div className="max-w-md w-full border border-cyan/20 bg-blueprint/30 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 border border-heat/40 mb-6">
          <ShieldAlert className="w-7 h-7 text-heat" />
        </div>
        <h1 className="font-heading text-2xl uppercase text-data mb-3">Access Restricted</h1>
        <p className="font-mono text-xs text-muted-foreground mb-6 leading-relaxed">
          // You are not registered to use this system. Please contact us to request access
          or use the public site to book service.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:glow-cyan transition-all">
          Return to Base
        </Link>
        <div className="mt-5 font-mono text-[10px] text-muted-foreground/60">
          <a href="tel:+15135682744" className="hover:text-cyan">513-568-2744</a> · <a href="mailto:tcincy23@gmail.com" className="hover:text-cyan">tcincy23@gmail.com</a>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;