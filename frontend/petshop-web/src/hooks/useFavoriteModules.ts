import { useState, useCallback } from "react";

const STORAGE_KEY = "vapp:favorites";

function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useFavoriteModules() {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const toggle = useCallback((moduleId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (moduleId: string) => favorites.includes(moduleId),
    [favorites],
  );

  return { favorites, toggle, isFavorite };
}
