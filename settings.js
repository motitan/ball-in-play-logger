(() => {
  const preferencesApi = window.BIPPreferences;
  if (!preferencesApi) {
    return;
  }

  const CUSTOM_TIME_ZONE_OPTION = "__custom__";
  const PRESET_TIME_ZONES = new Set(["", "UTC", "Europe/Madrid"]);
  const el = {
    themeDarkBtn: document.getElementById("settingsThemeDarkBtn"),
    themeLightBtn: document.getElementById("settingsThemeLightBtn"),
    timeZoneSelect: document.getElementById("settingsTimeZoneSelect"),
    customTimeZoneWrap: document.getElementById("settingsCustomTimeZoneWrap"),
    customTimeZoneInput: document.getElementById("settingsCustomTimeZoneInput"),
    applyTimeZoneBtn: document.getElementById("settingsApplyTimeZoneBtn"),
    previewClock: document.getElementById("settingsPreviewClock"),
    previewDate: document.getElementById("settingsPreviewDate"),
    previewZone: document.getElementById("settingsPreviewZone"),
    previewNote: document.getElementById("settingsPreviewNote"),
    exportExplanation: document.getElementById("settingsExportExplanation"),
    status: document.getElementById("settingsStatus"),
    srStatus: document.getElementById("settingsSrStatus"),
  };

  bindEvents();
  renderAll();
  window.setInterval(() => renderPreview(preferencesApi.read()), 1000);

  function bindEvents() {
    el.themeDarkBtn?.addEventListener("click", () => saveTheme("dark"));
    el.themeLightBtn?.addEventListener("click", () => saveTheme("light"));
    el.timeZoneSelect?.addEventListener("change", handleTimeZoneSelectChange);
    el.applyTimeZoneBtn?.addEventListener("click", saveCustomTimeZone);
    el.customTimeZoneInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveCustomTimeZone();
      }
    });
    window.addEventListener("storage", handleStorageSync);
    window.addEventListener("bip:preferences-changed", () => renderAll());
  }

  function handleStorageSync(event) {
    if (!event.key || ![preferencesApi.STORAGE_KEY, preferencesApi.LEGACY_THEME_KEY].includes(event.key)) {
      return;
    }

    renderAll();
  }

  function saveTheme(theme) {
    const nextPreferences = preferencesApi.write({ theme });
    announce(`Theme saved: ${capitalize(nextPreferences.theme)} mode.`);
    renderAll();
  }

  function handleTimeZoneSelectChange() {
    const selectedValue = el.timeZoneSelect?.value || "";
    if (selectedValue === CUSTOM_TIME_ZONE_OPTION) {
      const currentPreferences = preferencesApi.read();
      if (el.customTimeZoneInput && !el.customTimeZoneInput.value.trim()) {
        el.customTimeZoneInput.value = currentPreferences.timeZone || preferencesApi.getResolvedTimeZone(currentPreferences);
      }
      renderAll();
      window.requestAnimationFrame(() => {
        el.customTimeZoneInput?.focus();
        el.customTimeZoneInput?.select();
      });
      return;
    }

    const nextPreferences = preferencesApi.write({ timeZone: selectedValue });
    announce(`Time zone saved: ${preferencesApi.getTimeZoneLabel(nextPreferences)}.`);
    renderAll();
  }

  function saveCustomTimeZone() {
    const nextZone = String(el.customTimeZoneInput?.value || "").trim();
    if (!preferencesApi.isValidTimeZone(nextZone)) {
      announce("Use a valid IANA time zone, for example Europe/Madrid or America/New_York.", true);
      el.customTimeZoneInput?.focus();
      el.customTimeZoneInput?.select();
      return;
    }

    const nextPreferences = preferencesApi.write({ timeZone: nextZone });
    announce(`Time zone saved: ${preferencesApi.getTimeZoneLabel(nextPreferences)}.`);
    renderAll();
  }

  function renderAll() {
    const preferences = preferencesApi.read();
    const storedTimeZone = preferences.timeZone;
    const selectValue = storedTimeZone === "" || PRESET_TIME_ZONES.has(storedTimeZone)
      ? storedTimeZone
      : CUSTOM_TIME_ZONE_OPTION;

    el.themeDarkBtn?.setAttribute("aria-pressed", String(preferences.theme === "dark"));
    el.themeLightBtn?.setAttribute("aria-pressed", String(preferences.theme === "light"));
    if (el.timeZoneSelect) {
      el.timeZoneSelect.value = selectValue;
    }
    if (el.customTimeZoneWrap) {
      el.customTimeZoneWrap.hidden = selectValue !== CUSTOM_TIME_ZONE_OPTION;
    }
    if (el.customTimeZoneInput && selectValue === CUSTOM_TIME_ZONE_OPTION) {
      el.customTimeZoneInput.value = storedTimeZone;
    }
    renderPreview(preferences);
  }

  function renderPreview(preferences) {
    const timeZone = preferencesApi.getResolvedTimeZone(preferences);
    const label = preferencesApi.getTimeZoneLabel(preferences);
    const now = new Date();

    if (el.previewClock) {
      el.previewClock.textContent = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
    }

    if (el.previewDate) {
      el.previewDate.textContent = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(now);
    }

    if (el.previewZone) {
      el.previewZone.textContent = label;
    }

    if (el.previewNote) {
      el.previewNote.textContent = `Logger converts manually entered task times using ${label}.`;
    }

    if (el.exportExplanation) {
      el.exportExplanation.textContent =
        "Exported *_unix_ms values stay as Unix milliseconds. This setting only changes which wall-clock zone Logger uses before writing those numbers.";
    }
  }

  function announce(message, isError = false) {
    if (el.status) {
      el.status.textContent = message;
      el.status.dataset.state = isError ? "error" : "saved";
    }
    if (el.srStatus) {
      el.srStatus.textContent = message;
    }
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
})();
