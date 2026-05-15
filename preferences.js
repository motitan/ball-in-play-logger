(() => {
  const STORAGE_KEY = "ball-in-play-logger-preferences-v1";
  const LEGACY_THEME_KEY = "ball-in-play-logger-theme-v1";
  const DEFAULTS = {
    theme: "dark",
    timeZone: "",
  };

  function isValidTimeZone(value) {
    const text = String(value || "").trim();
    if (!text) {
      return false;
    }

    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: text }).format(new Date());
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeTheme(value) {
    return value === "light" ? "light" : "dark";
  }

  function normalizeTimeZone(value) {
    const text = String(value || "").trim();
    return isValidTimeZone(text) ? text : "";
  }

  function readLegacyTheme() {
    try {
      const value = localStorage.getItem(LEGACY_THEME_KEY);
      return value === "light" || value === "dark" ? value : "";
    } catch (error) {
      return "";
    }
  }

  function normalizePreferences(raw = {}) {
    return {
      theme: normalizeTheme(raw.theme || readLegacyTheme() || DEFAULTS.theme),
      timeZone: normalizeTimeZone(raw.timeZone),
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizePreferences(JSON.parse(raw)) : normalizePreferences();
    } catch (error) {
      return normalizePreferences();
    }
  }

  function write(patch = {}) {
    const nextPreferences = normalizePreferences({ ...read(), ...patch });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPreferences));
      localStorage.setItem(LEGACY_THEME_KEY, nextPreferences.theme);
    } catch (error) {
      console.error("Unable to persist preferences", error);
    }

    window.dispatchEvent(
      new CustomEvent("bip:preferences-changed", {
        detail: nextPreferences,
      })
    );

    return nextPreferences;
  }

  function getResolvedTimeZone(preferences = read()) {
    if (preferences.timeZone) {
      return preferences.timeZone;
    }

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(browserZone) ? browserZone : "UTC";
  }

  function getTimeZoneLabel(preferences = read()) {
    return preferences.timeZone || `Device local (${getResolvedTimeZone(preferences)})`;
  }

  window.BIPPreferences = {
    STORAGE_KEY,
    LEGACY_THEME_KEY,
    read,
    write,
    isValidTimeZone,
    getResolvedTimeZone,
    getTimeZoneLabel,
  };
})();
