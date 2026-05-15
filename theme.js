(() => {
  const THEME_COLORS = {
    dark: "#0b0f14",
    light: "#f7f2ea",
  };
  const preferencesApi = window.BIPPreferences;
  const fallbackStorageKey = preferencesApi?.STORAGE_KEY || "ball-in-play-logger-preferences-v1";
  const legacyThemeKey = preferencesApi?.LEGACY_THEME_KEY || "ball-in-play-logger-theme-v1";

  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  bindEvents();
  applyTheme(readStoredTheme());

  function bindEvents() {
    window.addEventListener("storage", (event) => {
      if (!event.key || ![fallbackStorageKey, legacyThemeKey].includes(event.key)) {
        return;
      }
      applyTheme(readStoredTheme());
    });
    window.addEventListener("bip:preferences-changed", (event) => {
      applyTheme(normalizeTheme(event.detail?.theme));
    });
  }

  function applyTheme(theme) {
    const nextTheme = normalizeTheme(theme);
    root.dataset.theme = nextTheme;
    themeMeta?.setAttribute("content", THEME_COLORS[nextTheme]);
  }

  function readStoredTheme() {
    if (preferencesApi?.read) {
      return normalizeTheme(preferencesApi.read().theme);
    }

    try {
      const raw = localStorage.getItem(fallbackStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      const legacyTheme = localStorage.getItem(legacyThemeKey);
      return normalizeTheme(parsed?.theme || legacyTheme);
    } catch (error) {
      return "dark";
    }
  }

  function normalizeTheme(value) {
    return value === "light" ? "light" : "dark";
  }
})();
