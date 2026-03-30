(() => {
  const STORAGE_KEY = "ball-in-play-logger-session-v1";
  const DEFAULT_PERIOD = "First Half";
  const CLOCK_TICK_MS = 250;
  const MAX_PERIOD_LENGTH = 48;

  const typeLabels = {
    play: "Play",
    pause: "Pause",
    ruck: "Ruck",
  };

  const elements = {
    periodInput: document.getElementById("periodInput"),
    periodBadge: document.getElementById("periodBadge"),
    clockDisplay: document.getElementById("clockDisplay"),
    liveStatus: document.getElementById("liveStatus"),
    savePill: document.getElementById("savePill"),
    statePill: document.getElementById("statePill"),
    playBtn: document.getElementById("playBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    ruckBtn: document.getElementById("ruckBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    resetBtn: document.getElementById("resetBtn"),
    eventCount: document.getElementById("eventCount"),
    ruckCount: document.getElementById("ruckCount"),
    sessionStarted: document.getElementById("sessionStarted"),
    lastEvent: document.getElementById("lastEvent"),
    emptyState: document.getElementById("emptyState"),
    eventsList: document.getElementById("eventsList"),
    srStatus: document.getElementById("srStatus"),
  };

  const saveState = {
    available: true,
    lastSavedAt: null,
  };

  let session = loadSession();
  let tickTimer = null;

  bindEvents();
  renderAll();
  syncClockTimer();
  announce(session.events.length ? "Session restored from this device." : "Logger ready.");

  function bindEvents() {
    elements.periodInput.addEventListener("input", handlePeriodInput);
    elements.playBtn.addEventListener("click", () => handleAction("play"));
    elements.pauseBtn.addEventListener("click", () => handleAction("pause"));
    elements.ruckBtn.addEventListener("click", () => handleAction("ruck"));
    elements.exportCsvBtn.addEventListener("click", exportCsv);
    elements.exportJsonBtn.addEventListener("click", exportJson);
    elements.resetBtn.addEventListener("click", resetSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function handleVisibilityChange() {
    renderClock();
    if (!document.hidden) {
      announce("Session view refreshed.");
    }
  }

  function handlePeriodInput(event) {
    const nextValue = String(event.target.value || "").slice(0, MAX_PERIOD_LENGTH);
    session.currentPeriod = nextValue;
    persistSession("Period updated.");
    renderAll();
  }

  function handleAction(actionType) {
    if (actionType === "play" && session.clockState === "running") {
      announce("Play ignored because the clock is already running.");
      return;
    }

    if (actionType === "pause" && session.clockState === "paused") {
      announce("Pause ignored because the clock is already paused.");
      return;
    }

    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);

    if (actionType === "play") {
      appendEvent("play", elapsedMs, now);
      session.clockState = "running";
      session.lastStartedAt = now.toISOString();
      persistSession("Play logged.");
      syncClockTimer();
      renderAll();
      return;
    }

    if (actionType === "pause") {
      session.elapsedMs = elapsedMs;
      session.clockState = "paused";
      session.lastStartedAt = null;
      appendEvent("pause", elapsedMs, now);
      persistSession("Pause logged.");
      syncClockTimer();
      renderAll();
      return;
    }

    appendEvent("ruck", elapsedMs, now);
    persistSession("Ruck logged.");
    renderAll();
  }

  function appendEvent(type, elapsedMs, createdAt) {
    session.events.push({
      index: session.events.length + 1,
      type,
      period: getPeriodLabel(session.currentPeriod),
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      createdAt: createdAt.toISOString(),
    });
  }

  function exportCsv() {
    const snapshot = getExportSnapshot();
    const headers = ["index", "type", "period", "elapsed_ms", "elapsed_mm_ss", "created_at"];
    const rows = snapshot.events.map((eventItem) => [
      eventItem.index,
      eventItem.type,
      eventItem.period,
      eventItem.elapsedMs,
      formatClock(eventItem.elapsedMs),
      eventItem.createdAt,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    triggerDownload(`${buildFilenameBase(snapshot.exportedAt)}.csv`, csv, "text/csv;charset=utf-8");
    announce("CSV exported to this device.");
  }

  function exportJson() {
    const snapshot = getExportSnapshot();
    const json = `${JSON.stringify(snapshot, null, 2)}\n`;
    triggerDownload(
      `${buildFilenameBase(snapshot.exportedAt)}.json`,
      json,
      "application/json;charset=utf-8"
    );
    announce("JSON exported to this device.");
  }

  function resetSession() {
    const confirmed = window.confirm(
      "Reset this session? This clears the current event log from the browser."
    );

    if (!confirmed) {
      return;
    }

    session = createSession();
    persistSession("Session reset.");
    syncClockTimer();
    renderAll();
  }

  function triggerDownload(filename, contents, mimeType) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function persistSession(message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getPersistedSession()));
      saveState.available = true;
      saveState.lastSavedAt = new Date();
    } catch (error) {
      saveState.available = false;
      console.error("Unable to persist session", error);
    }

    announce(message);
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createSession();
      }

      return normalizeSession(JSON.parse(raw));
    } catch (error) {
      console.error("Unable to load stored session", error);
      return createSession();
    }
  }

  function normalizeSession(raw) {
    const base = createSession();

    if (!raw || typeof raw !== "object") {
      return base;
    }

    const nextSession = {
      sessionId: typeof raw.sessionId === "string" && raw.sessionId ? raw.sessionId : base.sessionId,
      createdAt: isValidDateString(raw.createdAt) ? raw.createdAt : base.createdAt,
      currentPeriod:
        typeof raw.currentPeriod === "string"
          ? raw.currentPeriod.slice(0, MAX_PERIOD_LENGTH)
          : base.currentPeriod,
      clockState: raw.clockState === "running" ? "running" : "paused",
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      lastStartedAt: isValidDateString(raw.lastStartedAt) ? raw.lastStartedAt : null,
      events: Array.isArray(raw.events)
        ? raw.events
            .map(normalizeEvent)
            .filter(Boolean)
            .map((eventItem, index) => ({ ...eventItem, index: index + 1 }))
        : [],
    };

    if (nextSession.clockState === "paused") {
      nextSession.lastStartedAt = null;
    }

    if (nextSession.clockState === "running" && !nextSession.lastStartedAt) {
      nextSession.clockState = "paused";
    }

    return nextSession;
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    if (!typeLabels[raw.type]) {
      return null;
    }

    return {
      index: 0,
      type: raw.type,
      period: getPeriodLabel(raw.period),
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      createdAt: isValidDateString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
    };
  }

  function createSession() {
    return {
      sessionId: createId(),
      createdAt: new Date().toISOString(),
      currentPeriod: DEFAULT_PERIOD,
      clockState: "paused",
      elapsedMs: 0,
      lastStartedAt: null,
      events: [],
    };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function getPersistedSession() {
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      currentPeriod: session.currentPeriod,
      clockState: session.clockState,
      elapsedMs: session.elapsedMs,
      lastStartedAt: session.lastStartedAt,
      events: session.events.map((eventItem) => ({ ...eventItem })),
    };
  }

  function getExportSnapshot() {
    const exportedAt = new Date().toISOString();
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      exportedAt,
      currentPeriod: session.currentPeriod,
      clockState: session.clockState,
      elapsedMs: getCurrentElapsedMs(),
      lastStartedAt: session.lastStartedAt,
      events: session.events.map((eventItem) => ({ ...eventItem })),
    };
  }

  function getCurrentElapsedMs(now = new Date()) {
    const baseElapsed = normalizeElapsedMs(session.elapsedMs);
    if (session.clockState !== "running" || !session.lastStartedAt) {
      return baseElapsed;
    }

    const startedAtMs = Date.parse(session.lastStartedAt);
    if (!Number.isFinite(startedAtMs)) {
      return baseElapsed;
    }

    return baseElapsed + Math.max(0, now.getTime() - startedAtMs);
  }

  function normalizeElapsedMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.round(parsed);
  }

  function renderAll() {
    const snapshot = getViewSnapshot();
    renderClock(snapshot);
    renderSession(snapshot);
    renderEvents(snapshot);
    renderSaveState();
    syncButtons(snapshot);
  }

  function renderClock(snapshot = getViewSnapshot()) {
    elements.clockDisplay.textContent = formatClock(snapshot.elapsedMs);
    elements.statePill.textContent = snapshot.clockState === "running" ? "Running" : "Paused";
    elements.periodBadge.textContent = snapshot.periodLabel;
    elements.liveStatus.textContent = snapshot.statusMessage;
  }

  function renderSession(snapshot = getViewSnapshot()) {
    if (elements.periodInput.value !== session.currentPeriod) {
      elements.periodInput.value = session.currentPeriod;
    }

    elements.eventCount.textContent = String(snapshot.events.length);
    elements.ruckCount.textContent = String(snapshot.ruckCount);
    elements.sessionStarted.textContent = formatDateTime(snapshot.createdAt);
    elements.lastEvent.textContent = snapshot.lastEventLabel;
  }

  function renderEvents(snapshot = getViewSnapshot()) {
    const hasEvents = snapshot.events.length > 0;
    elements.emptyState.hidden = hasEvents;
    elements.eventsList.innerHTML = hasEvents
      ? snapshot.events
          .slice()
          .reverse()
          .map((eventItem) => renderEventRow(eventItem))
          .join("")
      : "";
  }

  function renderEventRow(eventItem) {
    return `
      <article class="event-row" role="listitem" data-type="${escapeHtml(eventItem.type)}">
        <div class="event-cell">
          <div class="event-cell__label">Event</div>
          <div class="event-index">#${String(eventItem.index).padStart(2, "0")}</div>
        </div>
        <div class="event-cell">
          <div class="event-cell__label">Type</div>
          <div class="event-type event-type--${escapeHtml(eventItem.type)}">
            ${escapeHtml(typeLabels[eventItem.type])}
          </div>
        </div>
        <div class="event-cell">
          <div class="event-cell__label">Period</div>
          <div class="event-period">${escapeHtml(eventItem.period)}</div>
        </div>
        <div class="event-cell">
          <div class="event-cell__label">Elapsed</div>
          <div class="event-elapsed">${escapeHtml(formatClock(eventItem.elapsedMs))}</div>
        </div>
        <div class="event-cell">
          <div class="event-cell__label">Created</div>
          <div class="event-created">${escapeHtml(formatDateTime(eventItem.createdAt))}</div>
        </div>
      </article>
    `;
  }

  function renderSaveState() {
    if (!saveState.available) {
      elements.savePill.textContent = "Auto-save unavailable";
      return;
    }

    if (!saveState.lastSavedAt) {
      elements.savePill.textContent = "Auto-save ready";
      return;
    }

    elements.savePill.textContent = `Saved ${formatTimeOnly(saveState.lastSavedAt.toISOString())}`;
  }

  function syncButtons(snapshot = getViewSnapshot()) {
    const isRunning = snapshot.clockState === "running";
    elements.playBtn.disabled = isRunning;
    elements.pauseBtn.disabled = !isRunning;
    elements.playBtn.setAttribute("aria-disabled", String(isRunning));
    elements.pauseBtn.setAttribute("aria-disabled", String(!isRunning));
  }

  function syncClockTimer() {
    if (session.clockState === "running" && !tickTimer) {
      tickTimer = window.setInterval(() => {
        renderClock();
      }, CLOCK_TICK_MS);
      return;
    }

    if (session.clockState !== "running" && tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function getViewSnapshot() {
    const elapsedMs = getCurrentElapsedMs();
    const events = session.events.map((eventItem) => ({ ...eventItem }));
    const lastEvent = events[events.length - 1] || null;

    return {
      createdAt: session.createdAt,
      elapsedMs,
      clockState: session.clockState,
      periodLabel: getPeriodLabel(session.currentPeriod),
      events,
      ruckCount: events.filter((eventItem) => eventItem.type === "ruck").length,
      lastEventLabel: lastEvent
        ? `${typeLabels[lastEvent.type]} at ${formatClock(lastEvent.elapsedMs)}`
        : "None yet",
      statusMessage:
        session.clockState === "running"
          ? `Clock is running in ${getPeriodLabel(session.currentPeriod)}.`
          : "Clock is paused. Tap Play to begin.",
    };
  }

  function formatClock(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(Number(totalMs || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Invalid time";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function formatTimeOnly(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function buildFilenameBase(isoDate) {
    const date = new Date(isoDate);
    const stamp = [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
      "-",
      pad2(date.getHours()),
      pad2(date.getMinutes()),
      pad2(date.getSeconds()),
    ].join("");

    return `match-log-${stamp}`;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (!/[",\n]/.test(text)) {
      return text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  function getPeriodLabel(value) {
    const text = String(value || "").trim();
    return text || "Untitled Period";
  }

  function announce(message) {
    elements.srStatus.textContent = message;
  }

  function pad2(value) {
    return String(Math.max(0, Math.trunc(value))).padStart(2, "0");
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isValidDateString(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }
})();
