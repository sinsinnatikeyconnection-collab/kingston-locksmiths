import React, { useEffect } from "react";

// Silent time-of-day accent adapter. Sets a data-daynight attribute on the document
// root based on the visitor's local hour (7–18 = day, otherwise night), giving the
// cyan a subtle warmth shift by time of day. Re-evaluates every minute.
export default function DayNightAccent() {
  useEffect(() => {
    const apply = () => {
      const h = new Date().getHours();
      document.documentElement.dataset.daynight = (h >= 7 && h < 19) ? "day" : "night";
    };
    apply();
    const id = window.setInterval(apply, 60000);
    return () => clearInterval(id);
  }, []);
  return null;
}