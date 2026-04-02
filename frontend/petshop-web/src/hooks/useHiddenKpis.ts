import { useState } from "react";

const KEY = "vapp:hidden-kpis";

function load(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
}

export function useHiddenKpis() {
  const [hidden, setHidden] = useState<string[]>(load);

  function toggle(id: string) {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }

  function isHidden(id: string) {
    return hidden.includes(id);
  }

  return { hidden, toggle, isHidden };
}
