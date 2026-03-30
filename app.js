(() => {
  const STORAGE_KEY = "ball-in-play-logger-session-v1";
  const DEFAULT_PERIOD = "First Half";
  const DEFAULT_ACTIVITY_NAME = "Activity";
  const CLOCK_TICK_MS = 250;
  const MAX_PERIOD_LENGTH = 48;
  const MAX_ACTIVITY_LENGTH = 64;
  const MAX_TASK_LENGTH = 64;

  const eventTypeLabels = {
    play: "Play",
    pause: "Pause",
    task_start: "Task Start",
    task_end: "Task End",
    bip_start: "BIP Start",
    bip_end: "BIP End",
    ruck: "Ruck",
  };

  const elements = {
    activityNameInput: document.getElementById("activityNameInput"),
    taskNameInput: document.getElementById("taskNameInput"),
    periodInput: document.getElementById("periodInput"),
    periodBadge: document.getElementById("periodBadge"),
    activityBadge: document.getElementById("activityBadge"),
    taskBadge: document.getElementById("taskBadge"),
    bipBadge: document.getElementById("bipBadge"),
    clockDisplay: document.getElementById("clockDisplay"),
    liveStatus: document.getElementById("liveStatus"),
    savePill: document.getElementById("savePill"),
    statePill: document.getElementById("statePill"),
    playBtn: document.getElementById("playBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    taskBtn: document.getElementById("taskBtn"),
    taskBtnLabel: document.getElementById("taskBtnLabel"),
    taskBtnMeta: document.getElementById("taskBtnMeta"),
    bipBtn: document.getElementById("bipBtn"),
    bipBtnLabel: document.getElementById("bipBtnLabel"),
    bipBtnMeta: document.getElementById("bipBtnMeta"),
    ruckBtn: document.getElementById("ruckBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    resetBtn: document.getElementById("resetBtn"),
    eventCount: document.getElementById("eventCount"),
    taskCount: document.getElementById("taskCount"),
    bipCount: document.getElementById("bipCount"),
    ruckCount: document.getElementById("ruckCount"),
    sessionStarted: document.getElementById("sessionStarted"),
    lastEvent: document.getElementById("lastEvent"),
    timelineScale: document.getElementById("timelineScale"),
    timelineMap: document.getElementById("timelineMap"),
    timelineEmpty: document.getElementById("timelineEmpty"),
    selectionTitle: document.getElementById("selectionTitle"),
    selectionMeta: document.getElementById("selectionMeta"),
    selectionSummary: document.getElementById("selectionSummary"),
    selectionActivity: document.getElementById("selectionActivity"),
    selectionPeriod: document.getElementById("selectionPeriod"),
    selectionTiming: document.getElementById("selectionTiming"),
    selectionDuration: document.getElementById("selectionDuration"),
    selectionContext: document.getElementById("selectionContext"),
    eventsEmptyState: document.getElementById("eventsEmptyState"),
    eventsList: document.getElementById("eventsList"),
    srStatus: document.getElementById("srStatus"),
  };

  const saveState = {
    available: true,
    lastSavedAt: null,
  };

  let session = loadSession();
  let tickTimer = null;
  let selectedEntity = { type: "session" };

  bindEvents();
  renderAll();
  syncClockTimer();
  announce(session.events.length ? "Session restored from this device." : "Logger ready.");

  function bindEvents() {
    elements.activityNameInput.addEventListener("input", handleActivityInput);
    elements.periodInput.addEventListener("input", handlePeriodInput);
    elements.taskNameInput.addEventListener("input", handleTaskNameInput);
    elements.playBtn.addEventListener("click", () => handleClockAction("play"));
    elements.pauseBtn.addEventListener("click", () => handleClockAction("pause"));
    elements.taskBtn.addEventListener("click", toggleTask);
    elements.bipBtn.addEventListener("click", toggleBip);
    elements.ruckBtn.addEventListener("click", addRuck);
    elements.exportCsvBtn.addEventListener("click", exportCsv);
    elements.exportJsonBtn.addEventListener("click", exportJson);
    elements.resetBtn.addEventListener("click", resetSession);
    elements.timelineMap.addEventListener("click", handleTimelineSelection);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function handleVisibilityChange() {
    renderClock();
    if (!document.hidden) {
      announce("Session view refreshed.");
    }
  }

  function handleActivityInput(event) {
    session.activityName = String(event.target.value || "").slice(0, MAX_ACTIVITY_LENGTH);
    persistSession("Activity name updated.");
    renderAll();
  }

  function handlePeriodInput(event) {
    session.currentPeriod = String(event.target.value || "").slice(0, MAX_PERIOD_LENGTH);
    persistSession("Period updated.");
    renderAll();
  }

  function handleTaskNameInput(event) {
    session.taskNameDraft = String(event.target.value || "").slice(0, MAX_TASK_LENGTH);
    persistSession("Task name updated.");
    renderAll();
  }

  function handleClockAction(actionType) {
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

    session.elapsedMs = elapsedMs;
    session.clockState = "paused";
    session.lastStartedAt = null;
    appendEvent("pause", elapsedMs, now);
    persistSession("Pause logged.");
    syncClockTimer();
    renderAll();
  }

  function toggleTask() {
    const activeTask = getActiveTask();
    if (!activeTask && session.clockState !== "running") {
      announce("Start the clock before creating a task.");
      return;
    }

    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);

    if (activeTask) {
      endTask(activeTask, elapsedMs, now);
      persistSession(`Task ended: ${activeTask.name}.`);
      renderAll();
      return;
    }

    const task = {
      id: createId(),
      name: getNextTaskName(),
      period: getPeriodLabel(session.currentPeriod),
      startElapsedMs: elapsedMs,
      endElapsedMs: null,
      createdAt: now.toISOString(),
      closedAt: null,
      bips: [],
      rucks: [],
    };

    session.tasks.push(task);
    session.activeTaskId = task.id;
    session.taskNameDraft = "";
    appendEvent("task_start", elapsedMs, now, {
      taskId: task.id,
      taskName: task.name,
      label: `Start ${task.name}`,
    });
    selectedEntity = { type: "task", taskId: task.id };
    persistSession(`Task started: ${task.name}.`);
    renderAll();
  }

  function endTask(task, elapsedMs, now) {
    if (session.activeBipId) {
      const activeBip = getActiveBip();
      if (activeBip) {
        endBip(activeBip, task, elapsedMs, now, true);
      }
    }

    task.endElapsedMs = elapsedMs;
    task.closedAt = now.toISOString();
    session.activeTaskId = null;
    appendEvent("task_end", elapsedMs, now, {
      taskId: task.id,
      taskName: task.name,
      label: `End ${task.name}`,
    });
    selectedEntity = { type: "task", taskId: task.id };
  }

  function toggleBip() {
    const task = getActiveTask();
    if (!task) {
      announce("Open a task before starting a BIP interval.");
      return;
    }

    const activeBip = getActiveBip();
    if (!activeBip && session.clockState !== "running") {
      announce("Start the clock before creating a BIP interval.");
      return;
    }

    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);

    if (activeBip) {
      endBip(activeBip, task, elapsedMs, now);
      persistSession(`BIP ended inside ${task.name}.`);
      renderAll();
      return;
    }

    const bip = {
      id: createId(),
      label: `BIP ${task.bips.length + 1}`,
      period: getPeriodLabel(session.currentPeriod),
      startElapsedMs: elapsedMs,
      endElapsedMs: null,
      createdAt: now.toISOString(),
      closedAt: null,
    };

    task.bips.push(bip);
    session.activeBipId = bip.id;
    appendEvent("bip_start", elapsedMs, now, {
      taskId: task.id,
      taskName: task.name,
      bipId: bip.id,
      bipName: bip.label,
      label: `Start ${bip.label}`,
    });
    selectedEntity = { type: "bip", taskId: task.id, bipId: bip.id };
    persistSession(`BIP started inside ${task.name}.`);
    renderAll();
  }

  function endBip(bip, task, elapsedMs, now, isTaskCascade = false) {
    bip.endElapsedMs = elapsedMs;
    bip.closedAt = now.toISOString();
    session.activeBipId = null;
    appendEvent("bip_end", elapsedMs, now, {
      taskId: task.id,
      taskName: task.name,
      bipId: bip.id,
      bipName: bip.label,
      label: `End ${bip.label}`,
    });
    selectedEntity = { type: "bip", taskId: task.id, bipId: bip.id };

    if (!isTaskCascade) {
      announce(`BIP ended inside ${task.name}.`);
    }
  }

  function addRuck() {
    if (session.clockState !== "running") {
      announce("Start the clock before adding a ruck event.");
      return;
    }

    const task = getActiveTask();
    if (!task) {
      announce("Open a task before adding a ruck event.");
      return;
    }

    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    const ruck = {
      id: createId(),
      period: getPeriodLabel(session.currentPeriod),
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      createdAt: now.toISOString(),
      bipId: session.activeBipId || null,
    };

    task.rucks.push(ruck);
    appendEvent("ruck", elapsedMs, now, {
      taskId: task.id,
      taskName: task.name,
      bipId: ruck.bipId,
      bipName: getBipName(task, ruck.bipId),
      label: "Ruck",
    });
    selectedEntity = { type: "ruck", taskId: task.id, ruckId: ruck.id };
    persistSession(`Ruck added to ${task.name}.`);
    renderAll();
  }

  function handleTimelineSelection(event) {
    const target = event.target.closest("[data-entity-type]");
    if (!target) {
      return;
    }

    selectedEntity = {
      type: target.dataset.entityType,
      taskId: target.dataset.taskId || null,
      bipId: target.dataset.bipId || null,
      ruckId: target.dataset.ruckId || null,
    };

    renderAll();
  }

  function resetSession() {
    const confirmed = window.confirm(
      "Reset this session? This clears the task map and event log from the browser."
    );

    if (!confirmed) {
      return;
    }

    session = createSession();
    selectedEntity = { type: "session" };
    persistSession("Session reset.");
    syncClockTimer();
    renderAll();
  }

  function exportCsv() {
    const snapshot = getExportSnapshot();
    const headers = [
      "session_id",
      "activity_name",
      "record_type",
      "event_type",
      "label",
      "task_id",
      "task_name",
      "bip_id",
      "bip_name",
      "period",
      "start_elapsed_ms",
      "end_elapsed_ms",
      "duration_ms",
      "event_elapsed_ms",
      "created_at",
    ];

    const rows = buildCsvRows(snapshot).map((row) => headers.map((header) => row[header] ?? ""));
    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    triggerDownload(
      `${buildFilenameBase(snapshot.activityName, snapshot.exportedAt)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    announce("CSV exported to this device.");
  }

  function exportJson() {
    const snapshot = getExportSnapshot();
    const json = `${JSON.stringify(snapshot, null, 2)}\n`;
    triggerDownload(
      `${buildFilenameBase(snapshot.activityName, snapshot.exportedAt)}.json`,
      json,
      "application/json;charset=utf-8"
    );
    announce("JSON exported to this device.");
  }

  function buildCsvRows(snapshot) {
    const rows = [];

    snapshot.tasks.forEach((task) => {
      rows.push({
        session_id: snapshot.sessionId,
        activity_name: snapshot.activityName,
        record_type: "task",
        event_type: "",
        label: task.name,
        task_id: task.id,
        task_name: task.name,
        bip_id: "",
        bip_name: "",
        period: task.period,
        start_elapsed_ms: task.startElapsedMs,
        end_elapsed_ms: task.effectiveEndElapsedMs,
        duration_ms: task.durationMs,
        event_elapsed_ms: "",
        created_at: task.createdAt,
      });

      task.bips.forEach((bip) => {
        rows.push({
          session_id: snapshot.sessionId,
          activity_name: snapshot.activityName,
          record_type: "bip",
          event_type: "",
          label: bip.label,
          task_id: task.id,
          task_name: task.name,
          bip_id: bip.id,
          bip_name: bip.label,
          period: bip.period,
          start_elapsed_ms: bip.startElapsedMs,
          end_elapsed_ms: bip.effectiveEndElapsedMs,
          duration_ms: bip.durationMs,
          event_elapsed_ms: "",
          created_at: bip.createdAt,
        });
      });

      task.rucks.forEach((ruck) => {
        rows.push({
          session_id: snapshot.sessionId,
          activity_name: snapshot.activityName,
          record_type: "ruck",
          event_type: "ruck",
          label: "Ruck",
          task_id: task.id,
          task_name: task.name,
          bip_id: ruck.bipId || "",
          bip_name: getBipName(task, ruck.bipId),
          period: ruck.period,
          start_elapsed_ms: "",
          end_elapsed_ms: "",
          duration_ms: "",
          event_elapsed_ms: ruck.elapsedMs,
          created_at: ruck.createdAt,
        });
      });
    });

    snapshot.events.forEach((eventItem) => {
      rows.push({
        session_id: snapshot.sessionId,
        activity_name: snapshot.activityName,
        record_type: "event",
        event_type: eventItem.type,
        label: eventItem.label,
        task_id: eventItem.taskId || "",
        task_name: eventItem.taskName || "",
        bip_id: eventItem.bipId || "",
        bip_name: eventItem.bipName || "",
        period: eventItem.period,
        start_elapsed_ms: "",
        end_elapsed_ms: "",
        duration_ms: "",
        event_elapsed_ms: eventItem.elapsedMs,
        created_at: eventItem.createdAt,
      });
    });

    return rows;
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
      activityName:
        typeof raw.activityName === "string"
          ? raw.activityName.slice(0, MAX_ACTIVITY_LENGTH)
          : base.activityName,
      currentPeriod:
        typeof raw.currentPeriod === "string"
          ? raw.currentPeriod.slice(0, MAX_PERIOD_LENGTH)
          : base.currentPeriod,
      taskNameDraft:
        typeof raw.taskNameDraft === "string"
          ? raw.taskNameDraft.slice(0, MAX_TASK_LENGTH)
          : base.taskNameDraft,
      clockState: raw.clockState === "running" ? "running" : "paused",
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      lastStartedAt: isValidDateString(raw.lastStartedAt) ? raw.lastStartedAt : null,
      activeTaskId: typeof raw.activeTaskId === "string" ? raw.activeTaskId : null,
      activeBipId: typeof raw.activeBipId === "string" ? raw.activeBipId : null,
      tasks: Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean) : [],
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

    if (!findTaskById(nextSession.tasks, nextSession.activeTaskId)) {
      nextSession.activeTaskId = null;
    }

    if (!findBipById(nextSession.tasks, nextSession.activeBipId)) {
      nextSession.activeBipId = null;
    }

    return nextSession;
  }

  function normalizeTask(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const taskId = typeof raw.id === "string" && raw.id ? raw.id : createId();

    return {
      id: taskId,
      name: getTaskLabel(raw.name, 1),
      period: getPeriodLabel(raw.period),
      startElapsedMs: normalizeElapsedMs(raw.startElapsedMs),
      endElapsedMs:
        raw.endElapsedMs === null || raw.endElapsedMs === undefined
          ? null
          : normalizeElapsedMs(raw.endElapsedMs),
      createdAt: isValidDateString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      closedAt: isValidDateString(raw.closedAt) ? raw.closedAt : null,
      bips: Array.isArray(raw.bips) ? raw.bips.map(normalizeBip).filter(Boolean) : [],
      rucks: Array.isArray(raw.rucks) ? raw.rucks.map(normalizeRuck).filter(Boolean) : [],
    };
  }

  function normalizeBip(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      label: getBipLabel(raw.label, 1),
      period: getPeriodLabel(raw.period),
      startElapsedMs: normalizeElapsedMs(raw.startElapsedMs),
      endElapsedMs:
        raw.endElapsedMs === null || raw.endElapsedMs === undefined
          ? null
          : normalizeElapsedMs(raw.endElapsedMs),
      createdAt: isValidDateString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      closedAt: isValidDateString(raw.closedAt) ? raw.closedAt : null,
    };
  }

  function normalizeRuck(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      period: getPeriodLabel(raw.period),
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      createdAt: isValidDateString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      bipId: typeof raw.bipId === "string" ? raw.bipId : null,
    };
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const type = eventTypeLabels[raw.type] ? raw.type : null;
    if (!type) {
      return null;
    }

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      index: 0,
      type,
      label: getEventLabel(type, raw),
      period: getPeriodLabel(raw.period),
      elapsedMs: normalizeElapsedMs(raw.elapsedMs),
      createdAt: isValidDateString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      taskId: typeof raw.taskId === "string" ? raw.taskId : null,
      taskName: typeof raw.taskName === "string" ? raw.taskName : "",
      bipId: typeof raw.bipId === "string" ? raw.bipId : null,
      bipName: typeof raw.bipName === "string" ? raw.bipName : "",
    };
  }

  function createSession() {
    return {
      sessionId: createId(),
      createdAt: new Date().toISOString(),
      activityName: "",
      currentPeriod: DEFAULT_PERIOD,
      taskNameDraft: "",
      clockState: "paused",
      elapsedMs: 0,
      lastStartedAt: null,
      activeTaskId: null,
      activeBipId: null,
      tasks: [],
      events: [],
    };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function appendEvent(type, elapsedMs, createdAt, meta = {}) {
    session.events.push({
      id: createId(),
      index: session.events.length + 1,
      type,
      label: typeof meta.label === "string" ? meta.label : getEventLabel(type, meta),
      period: getPeriodLabel(session.currentPeriod),
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      createdAt: createdAt.toISOString(),
      taskId: meta.taskId || null,
      taskName: meta.taskName || "",
      bipId: meta.bipId || null,
      bipName: meta.bipName || "",
    });
  }

  function getPersistedSession() {
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      activityName: session.activityName,
      currentPeriod: session.currentPeriod,
      taskNameDraft: session.taskNameDraft,
      clockState: session.clockState,
      elapsedMs: session.elapsedMs,
      lastStartedAt: session.lastStartedAt,
      activeTaskId: session.activeTaskId,
      activeBipId: session.activeBipId,
      tasks: session.tasks.map((task) => ({
        ...task,
        bips: task.bips.map((bip) => ({ ...bip })),
        rucks: task.rucks.map((ruck) => ({ ...ruck })),
      })),
      events: session.events.map((eventItem) => ({ ...eventItem })),
    };
  }

  function getExportSnapshot() {
    const nowIso = new Date().toISOString();
    const elapsedMs = getCurrentElapsedMs();
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      exportedAt: nowIso,
      activityName: getActivityLabel(session.activityName),
      currentPeriod: getPeriodLabel(session.currentPeriod),
      clockState: session.clockState,
      elapsedMs,
      lastStartedAt: session.lastStartedAt,
      activeTaskId: session.activeTaskId,
      activeBipId: session.activeBipId,
      tasks: session.tasks.map((task) => exportTask(task, elapsedMs)),
      events: session.events.map((eventItem) => ({ ...eventItem })),
    };
  }

  function exportTask(task, currentElapsedMs) {
    const effectiveEnd = getTaskEffectiveEnd(task, currentElapsedMs);
    return {
      ...task,
      effectiveEndElapsedMs: effectiveEnd,
      durationMs: Math.max(0, effectiveEnd - task.startElapsedMs),
      bips: task.bips.map((bip) => {
        const bipEnd = getBipEffectiveEnd(bip, currentElapsedMs);
        return {
          ...bip,
          effectiveEndElapsedMs: bipEnd,
          durationMs: Math.max(0, bipEnd - bip.startElapsedMs),
        };
      }),
      rucks: task.rucks.map((ruck) => ({ ...ruck })),
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
    renderTimeline(snapshot);
    renderEvents(snapshot);
    renderSaveState();
    syncButtons(snapshot);
  }

  function renderClock(snapshot = getViewSnapshot()) {
    elements.clockDisplay.textContent = formatClock(snapshot.elapsedMs);
    elements.statePill.textContent = snapshot.clockState === "running" ? "Running" : "Paused";
    elements.periodBadge.textContent = snapshot.periodLabel;
    elements.activityBadge.textContent = snapshot.activityLabel;
    elements.taskBadge.textContent = snapshot.activeTask ? snapshot.activeTask.name : "No active task";
    elements.bipBadge.textContent = snapshot.activeBip ? snapshot.activeBip.label : "No active BIP";
    elements.liveStatus.textContent = snapshot.statusMessage;
  }

  function renderSession(snapshot = getViewSnapshot()) {
    syncInputValue(elements.activityNameInput, session.activityName);
    syncInputValue(elements.periodInput, session.currentPeriod);
    syncInputValue(elements.taskNameInput, session.taskNameDraft);

    elements.taskCount.textContent = String(snapshot.tasks.length);
    elements.bipCount.textContent = String(snapshot.bipCount);
    elements.ruckCount.textContent = String(snapshot.ruckCount);
    elements.eventCount.textContent = String(snapshot.events.length);
    elements.sessionStarted.textContent = formatDateTime(snapshot.createdAt);
    elements.lastEvent.textContent = snapshot.lastEventLabel;
  }

  function renderTimeline(snapshot = getViewSnapshot()) {
    elements.timelineScale.innerHTML = buildScale(snapshot.totalDurationMs);

    const hasTasks = snapshot.tasks.length > 0;
    elements.timelineEmpty.hidden = hasTasks;
    elements.timelineMap.innerHTML = hasTasks
      ? snapshot.tasks.map((task) => renderTaskRow(task, snapshot)).join("")
      : "";

    renderSelection(snapshot);
  }

  function renderEvents(snapshot = getViewSnapshot()) {
    const hasEvents = snapshot.events.length > 0;
    elements.eventsEmptyState.hidden = hasEvents;
    elements.eventsList.innerHTML = hasEvents
      ? snapshot.events
          .slice()
          .reverse()
          .map((eventItem) => renderEventRow(eventItem, snapshot.activityLabel))
          .join("")
      : "";
  }

  function renderTaskRow(task, snapshot) {
    const taskSelected = selectedEntity.taskId === task.id && selectedEntity.type !== "session";
    const taskDuration = Math.max(0, task.effectiveEndElapsedMs - task.startElapsedMs);
    const taskTiming = `${formatClock(task.startElapsedMs)} - ${formatClock(task.effectiveEndElapsedMs)}`;

    return `
      <article class="task-row${taskSelected ? " task-row--selected" : ""}" role="listitem">
        <button class="task-meta" type="button" data-entity-type="task" data-task-id="${escapeHtml(task.id)}">
          <span class="task-meta__name">${escapeHtml(task.name)}</span>
          <span class="task-meta__summary">
            ${escapeHtml(task.period)} | ${escapeHtml(taskTiming)} | ${escapeHtml(formatClock(taskDuration))} | ${task.bips.length} BIPs | ${task.rucks.length} rucks
          </span>
        </button>

        <div class="task-track">
          <button
            class="task-span${task.isActive ? " task-span--active" : ""}"
            type="button"
            style="${intervalStyle(task.startElapsedMs, task.effectiveEndElapsedMs, snapshot.totalDurationMs)}"
            data-entity-type="task"
            data-task-id="${escapeHtml(task.id)}"
            aria-label="${escapeHtml(task.name)}"
          >
            <span class="task-span__label">${escapeHtml(task.name)}</span>
          </button>

          ${task.bips
            .map((bip) =>
              renderBipSpan({
                task,
                bip,
                totalDurationMs: snapshot.totalDurationMs,
                isSelected:
                  selectedEntity.type === "bip" &&
                  selectedEntity.taskId === task.id &&
                  selectedEntity.bipId === bip.id,
              })
            )
            .join("")}

          ${task.rucks
            .map((ruck) =>
              renderRuckMarker({
                task,
                ruck,
                totalDurationMs: snapshot.totalDurationMs,
                isSelected:
                  selectedEntity.type === "ruck" &&
                  selectedEntity.taskId === task.id &&
                  selectedEntity.ruckId === ruck.id,
              })
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function renderBipSpan({ task, bip, totalDurationMs, isSelected }) {
    return `
      <button
        class="bip-span${bip.isActive ? " bip-span--active" : ""}${isSelected ? " bip-span--selected" : ""}"
        type="button"
        style="${intervalStyle(bip.startElapsedMs, bip.effectiveEndElapsedMs, totalDurationMs)}"
        data-entity-type="bip"
        data-task-id="${escapeHtml(task.id)}"
        data-bip-id="${escapeHtml(bip.id)}"
        aria-label="${escapeHtml(bip.label)}"
      >
        <span class="bip-span__label">${escapeHtml(bip.label)}</span>
      </button>
    `;
  }

  function renderRuckMarker({ task, ruck, totalDurationMs, isSelected }) {
    return `
      <button
        class="ruck-marker${isSelected ? " ruck-marker--selected" : ""}"
        type="button"
        style="left: ${toPercent(ruck.elapsedMs, totalDurationMs)}%;"
        data-entity-type="ruck"
        data-task-id="${escapeHtml(task.id)}"
        data-ruck-id="${escapeHtml(ruck.id)}"
        aria-label="Ruck ${escapeHtml(formatClock(ruck.elapsedMs))}"
      ></button>
    `;
  }

  function renderSelection(snapshot) {
    const selection = getSelectionDescriptor(snapshot);
    elements.selectionTitle.textContent = selection.title;
    elements.selectionMeta.textContent = selection.meta;
    elements.selectionSummary.textContent = selection.summary;
    elements.selectionActivity.textContent = selection.activity;
    elements.selectionPeriod.textContent = selection.period;
    elements.selectionTiming.textContent = selection.timing;
    elements.selectionDuration.textContent = selection.duration;
    elements.selectionContext.textContent = selection.context;
  }

  function renderEventRow(eventItem, activityLabel) {
    return `
      <article class="event-row" role="listitem" data-type="${escapeHtml(eventItem.type)}">
        <div class="event-cell">
          <div class="event-cell__label">Event</div>
          <div class="event-name">${escapeHtml(eventItem.label)}</div>
        </div>
        <div class="event-cell">
          <div class="event-cell__label">Type</div>
          <div class="event-type event-type--${escapeHtml(eventItem.type)}">
            ${escapeHtml(eventTypeLabels[eventItem.type])}
          </div>
        </div>
        <div class="event-cell">
          <div class="event-cell__label">Context</div>
          <div class="event-context">${escapeHtml(buildEventContext(eventItem, activityLabel))}</div>
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
    const hasActiveTask = Boolean(snapshot.activeTask);
    const hasActiveBip = Boolean(snapshot.activeBip);

    elements.playBtn.disabled = isRunning;
    elements.pauseBtn.disabled = !isRunning;
    elements.taskBtn.disabled = !isRunning && !hasActiveTask;
    elements.bipBtn.disabled = !hasActiveTask || (!isRunning && !hasActiveBip);
    elements.ruckBtn.disabled = !isRunning || !hasActiveTask;

    elements.taskBtnLabel.textContent = hasActiveTask ? "End Task" : "Start Task";
    elements.taskBtnMeta.textContent = hasActiveTask
      ? `Close ${snapshot.activeTask.name} at the current clock time`
      : "Open a task using the task name field";

    elements.bipBtnLabel.textContent = hasActiveBip ? "End BIP" : "Start BIP";
    elements.bipBtnMeta.textContent = hasActiveBip
      ? `Close ${snapshot.activeBip.label} inside ${snapshot.activeTask.name}`
      : hasActiveTask
        ? "Add a nested ball-in-play interval inside the active task"
        : "Start a task before creating a BIP interval";
  }

  function syncClockTimer() {
    if (session.clockState === "running" && !tickTimer) {
      tickTimer = window.setInterval(() => {
        renderClock();
        renderTimeline();
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
    const tasks = session.tasks.map((task) => toViewTask(task, elapsedMs));
    const activeTask = tasks.find((task) => task.id === session.activeTaskId) || null;
    const activeBip =
      activeTask && session.activeBipId
        ? activeTask.bips.find((bip) => bip.id === session.activeBipId) || null
        : null;
    const events = session.events.map((eventItem) => ({ ...eventItem }));
    const lastEvent = events[events.length - 1] || null;
    const bipCount = tasks.reduce((sum, task) => sum + task.bips.length, 0);
    const ruckCount = tasks.reduce((sum, task) => sum + task.rucks.length, 0);

    return {
      createdAt: session.createdAt,
      elapsedMs,
      clockState: session.clockState,
      activityLabel: getActivityLabel(session.activityName),
      periodLabel: getPeriodLabel(session.currentPeriod),
      tasks,
      events,
      activeTask,
      activeBip,
      bipCount,
      ruckCount,
      totalDurationMs: getTotalDurationMs(tasks, events, elapsedMs),
      lastEventLabel: lastEvent
        ? `${lastEvent.label} at ${formatClock(lastEvent.elapsedMs)}`
        : "None yet",
      statusMessage: buildStatusMessage({
        activityLabel: getActivityLabel(session.activityName),
        clockState: session.clockState,
        activeTask,
        activeBip,
      }),
    };
  }

  function toViewTask(task, currentElapsedMs) {
    const effectiveEndElapsedMs = getTaskEffectiveEnd(task, currentElapsedMs);
    return {
      ...task,
      effectiveEndElapsedMs,
      durationMs: Math.max(0, effectiveEndElapsedMs - task.startElapsedMs),
      isActive: session.activeTaskId === task.id && task.endElapsedMs === null,
      bips: task.bips.map((bip) => {
        const bipEnd = getBipEffectiveEnd(bip, currentElapsedMs);
        return {
          ...bip,
          effectiveEndElapsedMs: bipEnd,
          durationMs: Math.max(0, bipEnd - bip.startElapsedMs),
          isActive: session.activeBipId === bip.id && bip.endElapsedMs === null,
        };
      }),
      rucks: task.rucks.map((ruck) => ({ ...ruck })),
    };
  }

  function getSelectionDescriptor(snapshot) {
    const safeSelection = normalizeSelection(snapshot);
    selectedEntity = safeSelection;

    if (safeSelection.type === "task") {
      const task = snapshot.tasks.find((item) => item.id === safeSelection.taskId);
      if (task) {
        return {
          title: task.name,
          meta: "Task interval",
          summary: `${task.bips.length} BIPs and ${task.rucks.length} rucks captured in this task.`,
          activity: snapshot.activityLabel,
          period: task.period,
          timing: `${formatClock(task.startElapsedMs)} to ${formatClock(task.effectiveEndElapsedMs)}`,
          duration: formatClock(task.durationMs),
          context: task.isActive
            ? "Task is still active and will keep extending with the live clock."
            : "Task closed and is ready for export or review.",
        };
      }
    }

    if (safeSelection.type === "bip") {
      const task = snapshot.tasks.find((item) => item.id === safeSelection.taskId);
      const bip = task ? task.bips.find((item) => item.id === safeSelection.bipId) : null;
      if (task && bip) {
        return {
          title: bip.label,
          meta: "Nested BIP interval",
          summary: `Ball-in-play window inside ${task.name}.`,
          activity: snapshot.activityLabel,
          period: bip.period,
          timing: `${formatClock(bip.startElapsedMs)} to ${formatClock(bip.effectiveEndElapsedMs)}`,
          duration: formatClock(bip.durationMs),
          context: bip.isActive
            ? `Still active inside ${task.name}.`
            : `Closed inside ${task.name}.`,
        };
      }
    }

    if (safeSelection.type === "ruck") {
      const task = snapshot.tasks.find((item) => item.id === safeSelection.taskId);
      const ruck = task ? task.rucks.find((item) => item.id === safeSelection.ruckId) : null;
      if (task && ruck) {
        return {
          title: "Ruck",
          meta: "Point event",
          summary: ruck.bipId
            ? `Marked during ${getBipName(task, ruck.bipId)}.`
            : `Marked on ${task.name} outside a BIP interval.`,
          activity: snapshot.activityLabel,
          period: ruck.period,
          timing: formatClock(ruck.elapsedMs),
          duration: "Point event",
          context: `Attached to ${task.name}.`,
        };
      }
    }

    return {
      title: snapshot.activityLabel,
      meta: "Session overview",
      summary: `${snapshot.tasks.length} tasks, ${snapshot.bipCount} BIPs, ${snapshot.ruckCount} rucks, ${snapshot.events.length} total events.`,
      activity: snapshot.activityLabel,
      period: snapshot.periodLabel,
      timing: `Started ${formatDateTime(snapshot.createdAt)}`,
      duration: formatClock(snapshot.elapsedMs),
      context: snapshot.activeTask
        ? snapshot.activeBip
          ? `${snapshot.activeTask.name} is active with ${snapshot.activeBip.label} nested inside it.`
          : `${snapshot.activeTask.name} is active and ready for a BIP interval.`
        : "No active task. Start one to build the visualization.",
    };
  }

  function normalizeSelection(snapshot) {
    if (selectedEntity.type === "task" && snapshot.tasks.some((task) => task.id === selectedEntity.taskId)) {
      return selectedEntity;
    }

    if (selectedEntity.type === "bip") {
      const task = snapshot.tasks.find((item) => item.id === selectedEntity.taskId);
      if (task && task.bips.some((bip) => bip.id === selectedEntity.bipId)) {
        return selectedEntity;
      }
    }

    if (selectedEntity.type === "ruck") {
      const task = snapshot.tasks.find((item) => item.id === selectedEntity.taskId);
      if (task && task.rucks.some((ruck) => ruck.id === selectedEntity.ruckId)) {
        return selectedEntity;
      }
    }

    if (snapshot.activeBip) {
      return {
        type: "bip",
        taskId: snapshot.activeTask.id,
        bipId: snapshot.activeBip.id,
      };
    }

    if (snapshot.activeTask) {
      return { type: "task", taskId: snapshot.activeTask.id };
    }

    if (snapshot.tasks[0]) {
      return { type: "task", taskId: snapshot.tasks[0].id };
    }

    return { type: "session" };
  }

  function buildScale(totalDurationMs) {
    const divisions = 5;
    return Array.from({ length: divisions }, (_, index) => {
      const ratio = divisions === 1 ? 0 : index / (divisions - 1);
      return `
        <div class="timeline-scale__item">
          <span class="timeline-scale__label">${escapeHtml(formatClock(totalDurationMs * ratio))}</span>
        </div>
      `;
    }).join("");
  }

  function buildStatusMessage({ activityLabel, clockState, activeTask, activeBip }) {
    if (clockState !== "running") {
      return `Clock is paused. Press Play to start ${activityLabel}.`;
    }

    if (activeTask && activeBip) {
      return `${activeTask.name} is live with ${activeBip.label} nested inside it.`;
    }

    if (activeTask) {
      return `${activeTask.name} is active. Start a BIP interval whenever ball is in play.`;
    }

    return `Clock is running for ${activityLabel}. Start a task to structure the session.`;
  }

  function getActiveTask() {
    return findTaskById(session.tasks, session.activeTaskId);
  }

  function getActiveBip() {
    return findBipById(session.tasks, session.activeBipId);
  }

  function findTaskById(tasks, taskId) {
    if (!taskId) {
      return null;
    }
    return tasks.find((task) => task.id === taskId) || null;
  }

  function findBipById(tasks, bipId) {
    if (!bipId) {
      return null;
    }

    for (const task of tasks) {
      const bip = task.bips.find((item) => item.id === bipId);
      if (bip) {
        return bip;
      }
    }

    return null;
  }

  function getTaskEffectiveEnd(task, currentElapsedMs) {
    return task.endElapsedMs === null ? currentElapsedMs : task.endElapsedMs;
  }

  function getBipEffectiveEnd(bip, currentElapsedMs) {
    return bip.endElapsedMs === null ? currentElapsedMs : bip.endElapsedMs;
  }

  function getTotalDurationMs(tasks, events, elapsedMs) {
    let maxValue = Math.max(1, elapsedMs);

    tasks.forEach((task) => {
      maxValue = Math.max(maxValue, task.effectiveEndElapsedMs, task.startElapsedMs);
      task.bips.forEach((bip) => {
        maxValue = Math.max(maxValue, bip.effectiveEndElapsedMs, bip.startElapsedMs);
      });
      task.rucks.forEach((ruck) => {
        maxValue = Math.max(maxValue, ruck.elapsedMs);
      });
    });

    events.forEach((eventItem) => {
      maxValue = Math.max(maxValue, eventItem.elapsedMs);
    });

    return maxValue;
  }

  function getNextTaskName() {
    return getTaskLabel(session.taskNameDraft, session.tasks.length + 1);
  }

  function getTaskLabel(value, fallbackIndex) {
    const text = String(value || "").trim();
    return text || `Task ${fallbackIndex}`;
  }

  function getBipLabel(value, fallbackIndex) {
    const text = String(value || "").trim();
    return text || `BIP ${fallbackIndex}`;
  }

  function getActivityLabel(value) {
    const text = String(value || "").trim();
    return text || DEFAULT_ACTIVITY_NAME;
  }

  function getPeriodLabel(value) {
    const text = String(value || "").trim();
    return text || "Untitled Period";
  }

  function getEventLabel(type, meta) {
    if (typeof meta.label === "string" && meta.label.trim()) {
      return meta.label.trim();
    }

    if (type === "task_start") {
      return `Start ${meta.taskName || "Task"}`;
    }

    if (type === "task_end") {
      return `End ${meta.taskName || "Task"}`;
    }

    if (type === "bip_start") {
      return `Start ${meta.bipName || "BIP"}`;
    }

    if (type === "bip_end") {
      return `End ${meta.bipName || "BIP"}`;
    }

    return eventTypeLabels[type] || "Event";
  }

  function buildEventContext(eventItem, activityLabel) {
    const context = [];

    if (eventItem.taskName) {
      context.push(eventItem.taskName);
    }

    if (eventItem.bipName) {
      context.push(eventItem.bipName);
    }

    return context.length ? context.join(" / ") : activityLabel;
  }

  function getBipName(task, bipId) {
    if (!bipId) {
      return "";
    }
    const bip = task.bips.find((item) => item.id === bipId);
    return bip ? bip.label : "";
  }

  function intervalStyle(startElapsedMs, endElapsedMs, totalDurationMs) {
    const safeStart = Math.max(0, startElapsedMs);
    const safeEnd = Math.max(safeStart, endElapsedMs);
    const left = toPercent(safeStart, totalDurationMs);
    const width = Math.max(toPercent(safeEnd - safeStart, totalDurationMs), 1.6);
    return `left: ${left}%; width: ${width}%;`;
  }

  function toPercent(value, total) {
    if (!Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return (Math.max(0, value) / total) * 100;
  }

  function syncInputValue(input, value) {
    if (input.value !== value) {
      input.value = value;
    }
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

  function buildFilenameBase(activityName, isoDate) {
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

    return `${slugify(activityName)}-${stamp}`;
  }

  function slugify(value) {
    const base = String(value || DEFAULT_ACTIVITY_NAME)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return base || "activity";
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (!/[",\n]/.test(text)) {
      return text;
    }

    return `"${text.replace(/"/g, '""')}"`;
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
