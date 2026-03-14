const STORAGE_KEY = "vapp:recents";
const MAX_RECENTS = 6;

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useRecentModules() {
  function track(moduleId: string) {
    const prev = load();
    const next = [moduleId, ...prev.filter((id) => id !== moduleId)].slice(
      0,
      MAX_RECENTS,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function getRecents(): string[] {
    return load();
  }

  return { track, getRecents };
}
