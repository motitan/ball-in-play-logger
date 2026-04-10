(() => {
  const STORAGE_KEY = "ball-in-play-logger-session-v1";
  const REVIEW_SOURCE_KEY = "ball-in-play-logger-review-source-v1";
  const DEFAULT_PERIOD = "";
  const DEFAULT_ACTIVITY = "Activity";
  const PROMPT_ACTIVITY = "Start activity";
  const PROMPT_PERIOD = "Name period";
  const EXPORT_PERIOD = "Untitled Period";
  const CLOCK_TICK_MS = 250;
  const RUCK_WINDOW_MS = 1500;
  const MADRID_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const MADRID_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const MADRID_DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const MAX_ACTIVITY = 64;
  const MAX_PERIOD = 48;
  const MAX_TASK = 64;

  const EVENT_LABELS = {
    play: "Play",
    pause: "Pause",
    task_start: "Task Start",
    task_end: "Task End",
    bip_start: "BIP Start",
    bip_end: "BIP End",
    ruck: "Ruck",
  };
  const EVENT_SORT_ORDER = {
    play: 0,
    task_start: 1,
    bip_start: 2,
    ruck: 3,
    bip_end: 4,
    task_end: 5,
    pause: 6,
  };

  const ICON_TASK_ADD = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  const ICON_TASK_STOP = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;
  const ICON_BIP_START = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>`;
  const ICON_BIP_STOP = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;

  const el = {
    activityBadge: document.getElementById("activityBadge"),
    periodBadge: document.getElementById("periodBadge"),
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
    taskBtnIcon: document.getElementById("taskBtnIcon"),
    bipBtn: document.getElementById("bipBtn"),
    bipBtnLabel: document.getElementById("bipBtnLabel"),
    bipBtnIcon: document.getElementById("bipBtnIcon"),
    ruckBtn: document.getElementById("ruckBtn"),
    periodInput: document.getElementById("periodInput"),
    selectedTaskPanel: document.getElementById("selectedTaskPanel"),
    selectedTaskTitle: document.getElementById("selectedTaskTitle"),
    selectedTaskState: document.getElementById("selectedTaskState"),
    selectedTaskMeta: document.getElementById("selectedTaskMeta"),
    selectedTaskNameInput: document.getElementById("selectedTaskNameInput"),
    selectedTaskActionBtn: document.getElementById("selectedTaskActionBtn"),
    selectedTaskStartBtn: document.getElementById("selectedTaskStartBtn"),
    selectedTaskStartTime: document.getElementById("selectedTaskStartTime"),
    selectedTaskEndBtn: document.getElementById("selectedTaskEndBtn"),
    selectedTaskEndTime: document.getElementById("selectedTaskEndTime"),
    deleteTaskBtn: document.getElementById("deleteTaskBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    resetBtn: document.getElementById("resetBtn"),
    newActivityBtn: document.getElementById("newActivityBtn"),
    finishBtn: document.getElementById("finishBtn"),
    taskCount: document.getElementById("taskCount"),
    bipCount: document.getElementById("bipCount"),
    ruckCount: document.getElementById("ruckCount"),
    eventCount: document.getElementById("eventCount"),
    timelineScale: document.getElementById("timelineScale"),
    timelineMap: document.getElementById("timelineMap"),
    timelineEmpty: document.getElementById("timelineEmpty"),
    logToggle: document.getElementById("logToggle"),
    logToggleCount: document.getElementById("logToggleCount"),
    logContent: document.getElementById("logContent"),
    logDrawer: document.getElementById("logDrawer"),
    eventsEmptyState: document.getElementById("eventsEmptyState"),
    eventsList: document.getElementById("eventsList"),
    activityModal: document.getElementById("activityModal"),
    activityForm: document.getElementById("activityForm"),
    activityModalInput: document.getElementById("activityModalInput"),
    activityModalError: document.getElementById("activityModalError"),
    activityCancelBtn: document.getElementById("activityCancelBtn"),
    timePickerModal: document.getElementById("timePickerModal"),
    timePickerBackdrop: document.getElementById("timePickerBackdrop"),
    timePickerEyebrow: document.getElementById("timePickerEyebrow"),
    timePickerTitle: document.getElementById("timePickerTitle"),
    timePickerSubtitle: document.getElementById("timePickerSubtitle"),
    timePickerHourList: document.getElementById("timePickerHourList"),
    timePickerMinuteList: document.getElementById("timePickerMinuteList"),
    timePickerSecondList: document.getElementById("timePickerSecondList"),
    timePickerCancelBtn: document.getElementById("timePickerCancelBtn"),
    timePickerSaveBtn: document.getElementById("timePickerSaveBtn"),
    srStatus: document.getElementById("srStatus"),
  };

  const saveState = { available: true, lastSavedAt: null };
  let session = loadSession();
  let reviewOverlaySession = loadReviewSourceSession();
  let tickTimer = null;
  let pendingPlayAfterNaming = false;
  let selectionCleared = false;
  let selectedTaskId = session.activeTaskId || session.tasks.at(-1)?.id || null;
  let finishConfirmExpiresAt = 0;
  let finishConfirmTimer = null;
  let timePickerState = createTimePickerState();
  const zipEncoder = new TextEncoder();
  const crcTable = buildCrcTable();

  bindEvents();
  renderAll();
  syncClockTimer();
  announce(session.events.length ? "Session restored." : "Logger ready.");

  function bindEvents() {
    el.playBtn.addEventListener("click", handlePlayIntent);
    el.pauseBtn.addEventListener("click", handlePauseIntent);
    el.taskBtn.addEventListener("click", handlePrimaryTaskAction);
    el.bipBtn.addEventListener("click", toggleBip);
    el.ruckBtn.addEventListener("click", addRuck);
    if (el.periodInput) {
      el.periodInput.addEventListener("input", handlePeriodInput);
    }
    el.selectedTaskNameInput.addEventListener("input", handleSelectedTaskRename);
    el.selectedTaskNameInput.addEventListener("blur", commitSelectedTaskRename);
    el.selectedTaskActionBtn.addEventListener("click", handleSelectedTaskAction);
    el.selectedTaskStartBtn.addEventListener("click", () => handleSelectedTaskBoundaryEdit("start"));
    el.selectedTaskEndBtn.addEventListener("click", () => handleSelectedTaskBoundaryEdit("end"));
    el.deleteTaskBtn.addEventListener("click", handleDeleteTaskIntent);
    el.exportCsvBtn.addEventListener("click", exportCsv);
    el.exportJsonBtn.addEventListener("click", exportJson);
    el.resetBtn.addEventListener("click", resetSession);
    el.newActivityBtn.addEventListener("click", handleNewActivityIntent);
    el.finishBtn.addEventListener("click", handleFinishIntent);
    el.logToggle.addEventListener("click", toggleLogDrawer);
    el.timelineMap.addEventListener("click", handleTimelineClick);
    el.activityForm.addEventListener("submit", handleActivitySubmit);
    el.activityCancelBtn.addEventListener("click", closeActivityModal);
    el.timePickerBackdrop.addEventListener("click", closeTimePickerModal);
    el.timePickerCancelBtn.addEventListener("click", closeTimePickerModal);
    el.timePickerSaveBtn.addEventListener("click", handleTimePickerSave);
    el.timePickerHourList.addEventListener("click", (event) => handleTimeWheelClick("hour", event));
    el.timePickerMinuteList.addEventListener("click", (event) => handleTimeWheelClick("minute", event));
    el.timePickerSecondList.addEventListener("click", (event) => handleTimeWheelClick("second", event));
    el.timePickerHourList.addEventListener("scroll", () => handleTimeWheelScroll("hour"));
    el.timePickerMinuteList.addEventListener("scroll", () => handleTimeWheelScroll("minute"));
    el.timePickerSecondList.addEventListener("scroll", () => handleTimeWheelScroll("second"));
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshExternalState();
        announce("View refreshed.");
      }
    });
    window.addEventListener("storage", handleExternalStorageSync);
    window.addEventListener("focus", refreshExternalState);
  }

  function handleExternalStorageSync(event) {
    if (event.key && ![STORAGE_KEY, REVIEW_SOURCE_KEY].includes(event.key)) {
      return;
    }

    refreshExternalState();
  }

  function refreshExternalState() {
    session = loadSession();
    reviewOverlaySession = loadReviewSourceSession();
    renderAll();
    syncClockTimer();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && !el.timePickerModal.hidden) {
      closeTimePickerModal();
      return;
    }

    if (event.key === "Escape" && !el.activityModal.hidden) {
      closeActivityModal();
    }
  }

  function handlePeriodInput(event) {
    session.currentPeriod = String(event.target.value || "").slice(0, MAX_PERIOD);
    persistSession("Period updated.");
    renderAll();
  }

  function handleSelectedTaskRename(event) {
    const task = getSelectedTaskFromSession();
    if (!task) {
      return;
    }

    task.name = String(event.target.value || "").slice(0, MAX_TASK);
    syncTaskEventNames(task);
    persistSession("Task name updated.");
    renderAll();
  }

  function commitSelectedTaskRename() {
    const task = getSelectedTaskFromSession();
    if (!task) {
      return;
    }

    task.name = taskLabel(task.name, getTaskOrdinal(task.id));
    syncTaskEventNames(task);
    persistSession(`Task renamed: ${task.name}.`);
    renderAll();
  }

  function handleSelectedTaskBoundaryEdit(boundary) {
    if (session.isFinished) {
      return;
    }

    const task = getSelectedTaskFromSession();
    if (!task) {
      return;
    }

    if (boundary === "end" && task.endElapsedMs === null) {
      window.alert("Stop the live task before setting a fixed end time.");
      return;
    }

    openTimePickerModal(task, boundary);
  }

  function openTimePickerModal(task, boundary) {
    const anchorUnixMs = getTaskBoundaryAnchorUnixMs(task, boundary);
    const parts = getMadridDateParts(anchorUnixMs);
    if (!parts) {
      window.alert("Unable to open the time picker for this task.");
      return;
    }

    timePickerState = {
      ...createTimePickerState(),
      open: true,
      boundary,
      taskId: task.id,
      anchorUnixMs,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
      restoreFocusId: boundary === "start" ? "selectedTaskStartBtn" : "selectedTaskEndBtn",
    };

    renderTimePickerModal();
    window.requestAnimationFrame(() => {
      syncTimePickerWheelPositions();
      el.timePickerSaveBtn.focus();
    });
  }

  function closeTimePickerModal(restoreFocus = true) {
    clearTimePickerScrollTimers();
    el.timePickerModal.hidden = true;

    const restoreFocusId = timePickerState.restoreFocusId;
    timePickerState = createTimePickerState();

    if (restoreFocus && restoreFocusId) {
      window.requestAnimationFrame(() => {
        document.getElementById(restoreFocusId)?.focus();
      });
    }
  }

  function handleTimePickerSave() {
    if (!timePickerState.open) {
      return;
    }

    const boundary = timePickerState.boundary;
    const task = findTask(session.tasks, timePickerState.taskId);
    if (!task) {
      closeTimePickerModal(false);
      return;
    }

    const targetUnixMs = resolveMadridClockUnixMs(
      timePickerState.anchorUnixMs,
      timePickerState.hour,
      timePickerState.minute,
      timePickerState.second
    );
    if (targetUnixMs === null) {
      window.alert("Unable to resolve that Madrid time.");
      return;
    }

    let targetElapsedMs = resolveElapsedMsFromUnixMs(targetUnixMs);
    if (targetElapsedMs === null) {
      const sessionZeroUnixMs = getSessionZeroUnixMs();
      const canShiftSessionEarlier =
        boundary === "start" &&
        isEarliestTask(task) &&
        Number.isFinite(sessionZeroUnixMs) &&
        targetUnixMs < sessionZeroUnixMs;

      if (canShiftSessionEarlier) {
        shiftSessionOriginEarlier(sessionZeroUnixMs - targetUnixMs, targetUnixMs);
        targetElapsedMs = 0;
      } else {
        window.alert("That time is outside the running session clock. Pick a time recorded while the clock was live.");
        return;
      }
    }

    const validationError = validateTaskBoundaryChange(task, boundary, targetElapsedMs);
    if (validationError) {
      window.alert(validationError);
      return;
    }

    applyTaskBoundaryChange(task, boundary, targetElapsedMs, targetUnixMs);
    closeTimePickerModal();
    persistSession(`Task ${boundary} updated: ${task.name}.`);
    renderAll();
  }

  function renderTimePickerModal() {
    if (!timePickerState.open) {
      el.timePickerModal.hidden = true;
      return;
    }

    const task = findTask(session.tasks, timePickerState.taskId);
    if (!task) {
      closeTimePickerModal(false);
      return;
    }

    const boundaryLabel = timePickerState.boundary === "start" ? "Start" : "End";
    el.timePickerModal.hidden = false;
    el.timePickerEyebrow.textContent = `Edit ${boundaryLabel.toLowerCase()} time`;
    el.timePickerTitle.textContent = `${task.name} ${boundaryLabel}`;
    el.timePickerSubtitle.textContent = `${fmtMadridDate(timePickerState.anchorUnixMs)} · Madrid time`;
    el.timePickerSaveBtn.textContent = `Save ${boundaryLabel.toLowerCase()} time`;
    el.timePickerHourList.innerHTML = buildTimeWheelOptions(24, timePickerState.hour, "hour");
    el.timePickerMinuteList.innerHTML = buildTimeWheelOptions(60, timePickerState.minute, "minute");
    el.timePickerSecondList.innerHTML = buildTimeWheelOptions(60, timePickerState.second, "second");
    window.requestAnimationFrame(syncTimePickerWheelPositions);
  }

  function buildTimeWheelOptions(count, selectedValue, part) {
    return Array.from({ length: count }, (_, value) => `
      <button
        class="time-picker-wheel__option${value === selectedValue ? " time-picker-wheel__option--selected" : ""}"
        type="button"
        role="option"
        aria-selected="${String(value === selectedValue)}"
        data-time-part="${part}"
        data-time-value="${value}"
      >
        ${esc(pad2(value))}
      </button>
    `).join("");
  }

  function handleTimeWheelClick(part, event) {
    const option = event.target.closest("[data-time-value]");
    if (!option || !timePickerState.open) {
      return;
    }

    setTimePickerValue(part, Number(option.dataset.timeValue), true);
  }

  function handleTimeWheelScroll(part) {
    if (!timePickerState.open || timePickerState.syncScroll) {
      return;
    }

    window.clearTimeout(timePickerState.scrollTimers[part]);
    timePickerState.scrollTimers[part] = window.setTimeout(() => {
      const list = getTimeWheelList(part);
      if (!list) {
        return;
      }

      const nextValue = getNearestTimeWheelValue(list);
      setTimePickerValue(part, nextValue, false);
      syncTimePickerWheelPositions();
    }, 90);
  }

  function setTimePickerValue(part, value, syncScroll = true) {
    timePickerState[part] = Math.max(0, Math.round(value));
    renderTimePickerModal();
    if (syncScroll) {
      window.requestAnimationFrame(syncTimePickerWheelPositions);
    }
  }

  function syncTimePickerWheelPositions() {
    if (!timePickerState.open) {
      return;
    }

    timePickerState.syncScroll = true;
    scrollTimeWheelToValue(el.timePickerHourList, timePickerState.hour);
    scrollTimeWheelToValue(el.timePickerMinuteList, timePickerState.minute);
    scrollTimeWheelToValue(el.timePickerSecondList, timePickerState.second);
    window.setTimeout(() => {
      timePickerState.syncScroll = false;
    }, 40);
  }

  function scrollTimeWheelToValue(list, value) {
    const option = list?.querySelector(`[data-time-value="${value}"]`);
    if (!list || !option) {
      return;
    }

    const targetTop = option.offsetTop - (list.clientHeight - option.clientHeight) / 2;
    list.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
  }

  function getNearestTimeWheelValue(list) {
    const options = [...list.querySelectorAll("[data-time-value]")];
    if (!options.length) {
      return 0;
    }

    const center = list.scrollTop + list.clientHeight / 2;
    let nearestValue = Number(options[0].dataset.timeValue);
    let nearestDistance = Number.POSITIVE_INFINITY;

    options.forEach((option) => {
      const optionCenter = option.offsetTop + option.clientHeight / 2;
      const distance = Math.abs(optionCenter - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestValue = Number(option.dataset.timeValue);
      }
    });

    return nearestValue;
  }

  function getTimeWheelList(part) {
    if (part === "hour") {
      return el.timePickerHourList;
    }
    if (part === "minute") {
      return el.timePickerMinuteList;
    }
    return el.timePickerSecondList;
  }

  function clearTimePickerScrollTimers() {
    Object.values(timePickerState.scrollTimers).forEach((timerId) => window.clearTimeout(timerId));
  }

  function handleDeleteTaskIntent() {
    if (session.isFinished) {
      return;
    }

    const task = getSelectedTaskFromSession();
    if (!task) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${task.name}? This removes the task, its BIPs, its rucks, and related task log rows.`
    );
    if (!confirmed) {
      return;
    }

    deleteTask(task.id);
  }

  function handlePlayIntent() {
    if (session.isFinished) {
      return;
    }

    if (session.clockState === "running") {
      return;
    }

    if (!hasValue(session.activityName)) {
      pendingPlayAfterNaming = true;
      openActivityModal();
      return;
    }

    startClock();
  }

  function handlePauseIntent() {
    if (session.isFinished) {
      return;
    }

    if (session.clockState !== "running") {
      return;
    }

    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    session.elapsedMs = elapsedMs;
    session.clockState = "paused";
    session.lastStartedAt = null;
    appendEvent("pause", elapsedMs, now);
    persistSession("Pause logged.");
    syncClockTimer();
    renderAll();
  }

  function startClock() {
    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    appendEvent("play", elapsedMs, now);
    session.clockState = "running";
    session.lastStartedAt = now.toISOString();
    persistSession("Play logged.");
    syncClockTimer();
    renderAll();
  }

  function handleActivitySubmit(event) {
    event.preventDefault();
    const value = String(el.activityModalInput.value || "").trim().slice(0, MAX_ACTIVITY);

    if (!value) {
      el.activityModalError.hidden = false;
      el.activityModalInput.focus();
      return;
    }

    session.activityName = value;
    persistSession("Activity locked.");
    closeActivityModal(false);
    renderAll();

    if (pendingPlayAfterNaming) {
      pendingPlayAfterNaming = false;
      startClock();
    }
  }

  function openActivityModal() {
    el.activityModal.hidden = false;
    el.activityModalError.hidden = true;
    el.activityModalInput.value = session.activityName;
    window.requestAnimationFrame(() => {
      el.activityModalInput.focus();
      el.activityModalInput.select();
    });
  }

  function closeActivityModal(resetPendingPlay = true) {
    el.activityModal.hidden = true;
    el.activityModalError.hidden = true;
    if (resetPendingPlay) {
      pendingPlayAfterNaming = false;
    }
  }

  function handlePrimaryTaskAction() {
    if (session.isFinished) {
      return;
    }

    const activeTask = getActiveTask();

    if (activeTask) {
      stopTask(activeTask);
      return;
    }

    if (session.clockState !== "running") {
      announce("Start the clock before creating a task.");
      return;
    }

    startTask();
  }

  function handleSelectedTaskAction() {
    if (session.isFinished) {
      return;
    }

    const selectedTask = getSelectedTaskFromSession();
    if (!selectedTask) {
      return;
    }

    if (session.activeTaskId === selectedTask.id) {
      stopTask(selectedTask);
      return;
    }

    const restartTaskError = getRestartTaskUnavailableReason(selectedTask);
    if (restartTaskError) {
      announce(restartTaskError);
      return;
    }

    restartTask(selectedTask);
  }

  function startTask(name = "") {
    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    const task = {
      id: createId(),
      name: taskLabel(name, session.tasks.length + 1),
      period: exportPeriodLabel(session.currentPeriod),
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
    setSelectedTask(task.id);
    appendEvent("task_start", elapsedMs, now, {
      taskId: task.id,
      taskName: task.name,
      label: `Start ${task.name}`,
    });
    persistSession(`Task started: ${task.name}.`);
    renderAll();
  }

  function stopTask(task) {
    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);

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
    setSelectedTask(task.id);
    persistSession(`Task ended: ${task.name}.`);
    renderAll();
  }

  function restartTask(task) {
    task.endElapsedMs = null;
    task.closedAt = null;
    session.activeTaskId = task.id;
    session.activeBipId = null;
    session.events = session.events
      .filter((eventItem) => !(eventItem.type === "task_end" && eventItem.taskId === task.id))
      .map((eventItem, index) => ({ ...eventItem, index: index + 1 }));
    setSelectedTask(task.id);
    persistSession(`Task restarted: ${task.name}.`);
    renderAll();
  }

  function toggleBip() {
    if (session.isFinished) {
      return;
    }

    const task = getActiveTask();
    if (!task) {
      announce("Start a task before adding BIP.");
      return;
    }

    const activeBip = getActiveBip();
    if (!activeBip && session.clockState !== "running") {
      announce("Start the clock first.");
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
      period: exportPeriodLabel(session.currentPeriod),
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
    persistSession(`BIP started inside ${task.name}.`);
    renderAll();
  }

  function endBip(bip, task, elapsedMs, now, isCascade = false) {
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

    if (!isCascade) {
      announce(`BIP ended inside ${task.name}.`);
    }
  }

  function addRuck() {
    if (session.isFinished) {
      return;
    }

    if (session.clockState !== "running") {
      announce("Start the clock first.");
      return;
    }

    const task = getActiveTask();
    if (!task) {
      announce("Start a task before adding a ruck.");
      return;
    }

    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    const ruck = {
      id: createId(),
      period: exportPeriodLabel(session.currentPeriod),
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
    persistSession(`Ruck added to ${task.name}.`);
    renderAll();
  }

  function handleTimelineClick(event) {
    const target = event.target.closest("[data-task-id]");
    if (!target) {
      return;
    }

    setSelectedTask(target.dataset.taskId);
    renderAll();
  }

  function setSelectedTask(taskId) {
    selectedTaskId = taskId;
    selectionCleared = false;
  }

  function clearTaskSelection() {
    selectedTaskId = null;
    selectionCleared = true;
    renderAll();
  }

  function deleteTask(taskId) {
    const taskIndex = session.tasks.findIndex((task) => task.id === taskId);
    if (taskIndex < 0) {
      return;
    }

    const [task] = session.tasks.splice(taskIndex, 1);
    const removedBipIds = new Set(task.bips.map((bip) => bip.id));

    if (session.activeTaskId === task.id) {
      session.activeTaskId = null;
    }

    if (session.activeBipId && removedBipIds.has(session.activeBipId)) {
      session.activeBipId = null;
    }

    session.events = session.events
      .filter((eventItem) => eventItem.taskId !== task.id && !(eventItem.bipId && removedBipIds.has(eventItem.bipId)))
      .map((eventItem, index) => ({ ...eventItem, index: index + 1 }));

    const fallbackTask = session.tasks[Math.min(taskIndex, session.tasks.length - 1)] || session.tasks.at(-1) || null;
    if (fallbackTask) {
      setSelectedTask(fallbackTask.id);
    } else {
      selectedTaskId = null;
      selectionCleared = false;
    }

    persistSession(`Task deleted: ${task.name}.`);
    renderAll();
  }

  function getTaskBoundaryAnchorUnixMs(task, boundary) {
    if (boundary === "start") {
      return getTaskStartUnixMs(task);
    }
    return getTaskEndUnixMs(task, task.closedAt || task.createdAt);
  }

  function resolveMadridClockUnixMs(anchorUnixMs, hour, minute, second) {
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      !Number.isInteger(second) ||
      hour < 0 ||
      minute < 0 ||
      second < 0 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      return null;
    }

    const anchorParts = getMadridDateParts(anchorUnixMs);
    if (!anchorParts) {
      return null;
    }

    const baseUnixMs = Date.UTC(anchorParts.year, anchorParts.month - 1, anchorParts.day, hour, minute, second);
    for (const offsetHours of [2, 1, 0]) {
      const candidateUnixMs = baseUnixMs - offsetHours * 60 * 60 * 1000;
      const candidateParts = getMadridDateParts(candidateUnixMs);
      if (
        candidateParts &&
        candidateParts.year === anchorParts.year &&
        candidateParts.month === anchorParts.month &&
        candidateParts.day === anchorParts.day &&
        candidateParts.hour === hour &&
        candidateParts.minute === minute &&
        candidateParts.second === second
      ) {
        return candidateUnixMs;
      }
    }

    return null;
  }

  function getMadridDateParts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const parts = Object.create(null);
    MADRID_DATE_TIME_FORMATTER.formatToParts(date).forEach((part) => {
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }
    });

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  }

  function getSessionZeroUnixMs() {
    const firstPlayEvent = session.events.find((eventItem) => eventItem.type === "play" && toUnixMs(eventItem.createdAt) !== "");
    if (firstPlayEvent) {
      return toUnixMs(firstPlayEvent.createdAt) - normMs(firstPlayEvent.elapsedMs);
    }

    const createdAtUnixMs = toUnixMs(session.createdAt);
    return createdAtUnixMs === "" ? null : createdAtUnixMs;
  }

  function isEarliestTask(task) {
    const earliestTask = session.tasks.reduce((earliest, candidate) => {
      if (!earliest) {
        return candidate;
      }
      return normMs(candidate.startElapsedMs) < normMs(earliest.startElapsedMs) ? candidate : earliest;
    }, null);

    return Boolean(earliestTask) && earliestTask.id === task.id;
  }

  function shiftSessionOriginEarlier(shiftMs, nextSessionZeroUnixMs) {
    const safeShiftMs = Math.max(0, Math.round(shiftMs));
    if (!safeShiftMs) {
      return;
    }

    session.elapsedMs = normMs(session.elapsedMs) + safeShiftMs;
    session.tasks.forEach((task) => {
      task.startElapsedMs = normMs(task.startElapsedMs) + safeShiftMs;
      if (task.endElapsedMs !== null) {
        task.endElapsedMs = normMs(task.endElapsedMs) + safeShiftMs;
      }

      task.bips.forEach((bip) => {
        bip.startElapsedMs = normMs(bip.startElapsedMs) + safeShiftMs;
        if (bip.endElapsedMs !== null) {
          bip.endElapsedMs = normMs(bip.endElapsedMs) + safeShiftMs;
        }
      });

      task.rucks.forEach((ruck) => {
        ruck.elapsedMs = normMs(ruck.elapsedMs) + safeShiftMs;
      });
    });

    session.events.forEach((eventItem) => {
      eventItem.elapsedMs = normMs(eventItem.elapsedMs) + safeShiftMs;
    });

    const currentCreatedAtUnixMs = toUnixMs(session.createdAt);
    const nextCreatedAtUnixMs =
      currentCreatedAtUnixMs === ""
        ? nextSessionZeroUnixMs
        : Math.min(currentCreatedAtUnixMs, nextSessionZeroUnixMs);
    session.createdAt = new Date(nextCreatedAtUnixMs).toISOString();
  }

  function resolveElapsedMsFromUnixMs(targetUnixMs) {
    if (!Number.isFinite(targetUnixMs)) {
      return null;
    }

    const sessionZeroUnixMs = getSessionZeroUnixMs();
    const firstPlayEvent = session.events.find((eventItem) => eventItem.type === "play" && toUnixMs(eventItem.createdAt) !== "");
    if (Number.isFinite(sessionZeroUnixMs) && firstPlayEvent) {
      const firstPlayUnixMs = toUnixMs(firstPlayEvent.createdAt);
      if (targetUnixMs >= sessionZeroUnixMs && targetUnixMs <= firstPlayUnixMs) {
        return Math.max(0, Math.round(targetUnixMs - sessionZeroUnixMs));
      }
    }

    let liveSegment = null;
    for (const eventItem of session.events) {
      if (eventItem.type === "play") {
        const startUnixMs = toUnixMs(eventItem.createdAt);
        if (startUnixMs === "") {
          continue;
        }

        liveSegment = {
          startUnixMs,
          startElapsedMs: normMs(eventItem.elapsedMs),
        };
        continue;
      }

      if (eventItem.type === "pause" && liveSegment) {
        const resolvedElapsedMs = resolveElapsedMsInsideSegment(
          liveSegment,
          {
            endUnixMs: toUnixMs(eventItem.createdAt),
            endElapsedMs: normMs(eventItem.elapsedMs),
          },
          targetUnixMs
        );
        if (resolvedElapsedMs !== null) {
          return resolvedElapsedMs;
        }

        liveSegment = null;
      }
    }

    if (liveSegment && session.clockState === "running" && session.lastStartedAt) {
      const now = new Date();
      return resolveElapsedMsInsideSegment(
        liveSegment,
        {
          endUnixMs: now.getTime(),
          endElapsedMs: getCurrentElapsedMs(now),
        },
        targetUnixMs
      );
    }

    return null;
  }

  function resolveElapsedMsInsideSegment(segment, endPoint, targetUnixMs) {
    if (
      !segment ||
      !Number.isFinite(segment.startUnixMs) ||
      !Number.isFinite(endPoint?.endUnixMs) ||
      targetUnixMs < segment.startUnixMs ||
      targetUnixMs > endPoint.endUnixMs
    ) {
      return null;
    }

    return Math.max(
      normMs(segment.startElapsedMs),
      Math.min(normMs(endPoint.endElapsedMs), normMs(segment.startElapsedMs) + (targetUnixMs - segment.startUnixMs))
    );
  }

  function validateTaskBoundaryChange(task, boundary, nextElapsedMs) {
    const currentElapsedMs = getCurrentElapsedMs();
    const nextStartElapsedMs = boundary === "start" ? nextElapsedMs : normMs(task.startElapsedMs);
    const nextEndElapsedMs = boundary === "end" ? nextElapsedMs : taskEndMs(task, currentElapsedMs);

    if (nextStartElapsedMs > nextEndElapsedMs) {
      return boundary === "start"
        ? "Warning: start time cannot be after the task end."
        : "Warning: end time cannot be before the task start.";
    }

    if (task.bips.length) {
      const firstBipStartElapsedMs = Math.min(...task.bips.map((bip) => normMs(bip.startElapsedMs)));
      const lastBipEndElapsedMs = Math.max(...task.bips.map((bip) => bipEndMs(bip, currentElapsedMs)));

      if (nextStartElapsedMs > firstBipStartElapsedMs) {
        return `Warning: ${task.name} would start after its first BIP.`;
      }

      if (nextEndElapsedMs < lastBipEndElapsedMs) {
        return `Warning: ${task.name} would end before its last BIP.`;
      }
    }

    const overlappingTask = findOverlappingTask(task.id, nextStartElapsedMs, nextEndElapsedMs, currentElapsedMs);
    if (overlappingTask) {
      return `Warning: ${task.name} would overlap ${overlappingTask.name}.`;
    }

    return "";
  }

  function findOverlappingTask(taskId, startElapsedMs, endElapsedMs, currentElapsedMs) {
    return session.tasks.find((task) => {
      if (task.id === taskId) {
        return false;
      }

      const otherStartElapsedMs = normMs(task.startElapsedMs);
      const otherEndElapsedMs = taskEndMs(task, currentElapsedMs);
      return startElapsedMs < otherEndElapsedMs && endElapsedMs > otherStartElapsedMs;
    }) || null;
  }

  function applyTaskBoundaryChange(task, boundary, nextElapsedMs, nextUnixMs) {
    const nextIso = new Date(nextUnixMs).toISOString();
    const safeElapsedMs = Math.max(0, Math.round(nextElapsedMs));

    if (boundary === "start") {
      task.startElapsedMs = safeElapsedMs;
      task.createdAt = nextIso;
    } else {
      task.endElapsedMs = safeElapsedMs;
      task.closedAt = nextIso;
    }

    syncTaskBoundaryEvents(task);
    sortTasksChronologically();
    sortEventsChronologically();
  }

  function syncTaskBoundaryEvents(task) {
    const startEvent = session.events.find((eventItem) => eventItem.type === "task_start" && eventItem.taskId === task.id);
    if (startEvent) {
      startEvent.elapsedMs = normMs(task.startElapsedMs);
      startEvent.createdAt = task.createdAt;
      startEvent.taskName = task.name;
      startEvent.label = eventLabel("task_start", { taskName: task.name });
      startEvent.period = exportPeriodLabel(task.period);
    }

    const endEvent = session.events.find((eventItem) => eventItem.type === "task_end" && eventItem.taskId === task.id);
    if (endEvent && task.endElapsedMs !== null && task.closedAt) {
      endEvent.elapsedMs = normMs(task.endElapsedMs);
      endEvent.createdAt = task.closedAt;
      endEvent.taskName = task.name;
      endEvent.label = eventLabel("task_end", { taskName: task.name });
      endEvent.period = exportPeriodLabel(task.period);
    }
  }

  function syncTaskEventNames(task) {
    session.events.forEach((eventItem) => {
      if (eventItem.taskId !== task.id) {
        return;
      }

      eventItem.taskName = task.name;
      if (eventItem.type === "task_start") {
        eventItem.label = eventLabel("task_start", { taskName: task.name });
      }
      if (eventItem.type === "task_end") {
        eventItem.label = eventLabel("task_end", { taskName: task.name });
      }
    });
  }

  function sortTasksChronologically() {
    session.tasks.sort((left, right) => {
      const startDiff = normMs(left.startElapsedMs) - normMs(right.startElapsedMs);
      if (startDiff) {
        return startDiff;
      }

      const endDiff =
        (left.endElapsedMs == null ? Number.MAX_SAFE_INTEGER : normMs(left.endElapsedMs)) -
        (right.endElapsedMs == null ? Number.MAX_SAFE_INTEGER : normMs(right.endElapsedMs));
      if (endDiff) {
        return endDiff;
      }

      return left.id.localeCompare(right.id);
    });
  }

  function sortEventsChronologically() {
    session.events = session.events
      .slice()
      .sort((left, right) => {
        const elapsedDiff = normMs(left.elapsedMs) - normMs(right.elapsedMs);
        if (elapsedDiff) {
          return elapsedDiff;
        }

        const createdDiff =
          (toUnixMs(left.createdAt) === "" ? Number.MAX_SAFE_INTEGER : toUnixMs(left.createdAt)) -
          (toUnixMs(right.createdAt) === "" ? Number.MAX_SAFE_INTEGER : toUnixMs(right.createdAt));
        if (createdDiff) {
          return createdDiff;
        }

        const typeDiff = (EVENT_SORT_ORDER[left.type] ?? 99) - (EVENT_SORT_ORDER[right.type] ?? 99);
        if (typeDiff) {
          return typeDiff;
        }

        return left.id.localeCompare(right.id);
      })
      .map((eventItem, index) => ({ ...eventItem, index: index + 1 }));
  }

  function toggleLogDrawer() {
    const opening = el.logContent.hidden;
    el.logContent.hidden = !opening;
    el.logToggle.setAttribute("aria-expanded", String(opening));
    el.logDrawer.classList.toggle("log-drawer--open", opening);
  }

  function resetSession() {
    if (!window.confirm("Reset this session? All data will be cleared from the browser.")) {
      return;
    }

    session = createSession();
    clearReviewSourceCache();
    selectedTaskId = null;
    selectionCleared = false;
    pendingPlayAfterNaming = false;
    clearFinishConfirm(false);
    closeActivityModal();
    persistSession("Session reset.");
    syncClockTimer();
    renderAll();
  }

  function handleNewActivityIntent() {
    if (!session.isFinished && sessionHasProgress()) {
      const confirmed = window.confirm(
        "Start a new activity? This clears the current one. Finish or export it first if you need to keep its files."
      );

      if (!confirmed) {
        return;
      }
    }

    startNewActivity();
  }

  function startNewActivity() {
    session = createSession();
    clearReviewSourceCache();
    selectedTaskId = null;
    selectionCleared = false;
    pendingPlayAfterNaming = true;
    clearFinishConfirm(false);
    closeActivityModal(false);
    persistSession("New activity ready.");
    syncClockTimer();
    renderAll();
    openActivityModal();
  }

  function handleFinishIntent() {
    if (session.isFinished) {
      return;
    }

    if (!hasValue(session.activityName)) {
      announce("Start the activity before finishing it.");
      return;
    }

    if (!isFinishConfirmArmed()) {
      armFinishConfirm();
      announce("Press Finish activity again, then confirm.");
      renderAll();
      return;
    }

    const confirmed = window.confirm(
      "Finish this activity? This will stop the session, close any live task or BIP, lock the logger, and download a ZIP with both CSV and JSON files."
    );

    if (!confirmed) {
      clearFinishConfirm();
      return;
    }

    finalizeActivity();
  }

  function finalizeActivity() {
    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    const activeTask = getActiveTask();

    if (session.activeBipId && activeTask) {
      const activeBip = getActiveBip();
      if (activeBip) {
        endBip(activeBip, activeTask, elapsedMs, now, true);
      }
    }

    if (activeTask) {
      activeTask.endElapsedMs = elapsedMs;
      activeTask.closedAt = now.toISOString();
      session.activeTaskId = null;
      appendEvent("task_end", elapsedMs, now, {
        taskId: activeTask.id,
        taskName: activeTask.name,
        label: `End ${activeTask.name}`,
      });
    }

    if (session.clockState === "running") {
      appendEvent("pause", elapsedMs, now);
    }

    session.elapsedMs = elapsedMs;
    session.clockState = "paused";
    session.lastStartedAt = null;
    session.activeBipId = null;
    session.isFinished = true;
    session.finishedAt = now.toISOString();

    clearFinishConfirm(false);
    persistSession("Activity finished.");
    syncClockTimer();
    renderAll();
    exportBundleZip();
    announce("Activity finished and ZIP downloaded.");
  }

  function exportCsv() {
    const snapshot = getExportSnapshot();
    triggerDownload(
      `${buildFilenameBase(snapshot.activityName, snapshot.exportedAt)}.csv`,
      buildCsvContent(snapshot),
      "text/csv;charset=utf-8"
    );
    announce("CSV exported.");
  }

  function exportJson() {
    const snapshot = getExportSnapshot();
    triggerDownload(
      `${buildFilenameBase(snapshot.activityName, snapshot.exportedAt)}.json`,
      buildJsonContent(snapshot),
      "application/json;charset=utf-8"
    );
    announce("JSON exported.");
  }

  function exportBundleZip() {
    const snapshot = getExportSnapshot();
    const base = buildFilenameBase(snapshot.activityName, snapshot.exportedAt);
    const zipBlob = buildZipBlob(base, [
      { name: `${base}.csv`, bytes: zipEncoder.encode(buildCsvContent(snapshot)) },
      { name: `${base}.json`, bytes: zipEncoder.encode(buildJsonContent(snapshot)) },
    ]);
    triggerBlobDownload(`${base}.zip`, zipBlob);
  }

  function buildCsvContent(snapshot) {
    const headers = [
      "activity_id",
      "activity_name",
      "entity_type",
      "task_id",
      "task_name",
      "bip_id",
      "bip_name",
      "ruck_id",
      "ruck_count",
      "start_time_unix_ms",
      "end_time_unix_ms",
      "start_time_seconds",
      "end_time_seconds",
      "ruck_time_unix_ms",
      "ruck_start_time_unix_ms",
      "ruck_end_time_unix_ms",
      "ruck_time_seconds",
      "ruck_start_time_seconds",
      "ruck_end_time_seconds",
      "duration_seconds",
      "pre_dead_ball_seconds",
      "post_dead_ball_seconds",
    ];
    const rows = buildExportRows(snapshot).map((row) => headers.map((header) => row[header] ?? ""));
    return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  function buildJsonContent(snapshot) {
    const columns = [
      "activity_id",
      "activity_name",
      "entity_type",
      "task_id",
      "task_name",
      "bip_id",
      "bip_name",
      "ruck_id",
      "ruck_count",
      "start_time_unix_ms",
      "end_time_unix_ms",
      "start_time_seconds",
      "end_time_seconds",
      "ruck_time_unix_ms",
      "ruck_start_time_unix_ms",
      "ruck_end_time_unix_ms",
      "ruck_time_seconds",
      "ruck_start_time_seconds",
      "ruck_end_time_seconds",
      "duration_seconds",
      "pre_dead_ball_seconds",
      "post_dead_ball_seconds",
    ];

    return `${JSON.stringify(
      {
        activity_id: snapshot.sessionId,
        activity_name: snapshot.activityName,
        exported_at_unix_ms: toUnixMs(snapshot.exportedAt),
        exported_at_iso: snapshot.exportedAt,
        columns,
        rows: buildExportRows(snapshot),
      },
      null,
      2
    )}\n`;
  }

  function buildExportRows(snapshot) {
    const rows = [];
    const base = { activity_id: snapshot.sessionId, activity_name: snapshot.activityName };
    const bipDeadBallById = buildBipDeadBallById(snapshot);

    snapshot.tasks.forEach((task) => {
      rows.push({
        ...base,
        entity_type: "task",
        task_id: task.id,
        task_name: task.name,
        bip_id: "",
        bip_name: "",
        ruck_id: "",
        start_time_unix_ms: getTaskStartUnixMs(task),
        end_time_unix_ms: getTaskEndUnixMs(task, snapshot.exportedAt),
        start_time_seconds: formatSeconds(task.startElapsedMs),
        end_time_seconds: formatSeconds(task.effectiveEndElapsedMs),
        ruck_time_unix_ms: "",
        ruck_start_time_unix_ms: "",
        ruck_end_time_unix_ms: "",
        ruck_time_seconds: "",
        ruck_start_time_seconds: "",
        ruck_end_time_seconds: "",
        duration_seconds: formatSeconds(task.durationMs),
        ruck_count: String(task.rucks.length),
        pre_dead_ball_seconds: "",
        post_dead_ball_seconds: "",
      });

      task.bips.forEach((bip) => {
        rows.push({
          ...base,
          entity_type: "bip",
          task_id: task.id,
          task_name: task.name,
          bip_id: bip.id,
          bip_name: bip.label,
          ruck_id: "",
          start_time_unix_ms: getBipStartUnixMs(bip),
          end_time_unix_ms: getBipEndUnixMs(bip, snapshot.exportedAt),
          start_time_seconds: formatSeconds(bip.startElapsedMs),
          end_time_seconds: formatSeconds(bip.effectiveEndElapsedMs),
          ruck_time_unix_ms: "",
          ruck_start_time_unix_ms: "",
          ruck_end_time_unix_ms: "",
          ruck_time_seconds: "",
          ruck_start_time_seconds: "",
          ruck_end_time_seconds: "",
          duration_seconds: formatSeconds(bip.durationMs),
          ruck_count: String(countBipRucks(task, bip.id)),
          pre_dead_ball_seconds: bipDeadBallById.get(bip.id)?.pre_dead_ball_seconds || "",
          post_dead_ball_seconds: bipDeadBallById.get(bip.id)?.post_dead_ball_seconds || "",
        });
      });

      task.rucks.forEach((ruck) => {
        rows.push({
          ...base,
          entity_type: "ruck",
          task_id: task.id,
          task_name: task.name,
          bip_id: ruck.bipId || "",
          bip_name: getBipName(task, ruck.bipId),
          ruck_id: ruck.id,
          start_time_unix_ms: getRuckUnixMs(ruck),
          end_time_unix_ms: getRuckUnixMs(ruck),
          start_time_seconds: formatSeconds(ruck.elapsedMs),
          end_time_seconds: formatSeconds(ruck.elapsedMs),
          ruck_time_unix_ms: getRuckTimeUnixMs(ruck),
          ruck_start_time_unix_ms: getRuckStartUnixMs(ruck),
          ruck_end_time_unix_ms: getRuckEndUnixMs(ruck),
          ruck_time_seconds: formatSeconds(ruck.elapsedMs),
          ruck_start_time_seconds: getRuckStartSeconds(ruck),
          ruck_end_time_seconds: getRuckEndSeconds(ruck),
          duration_seconds: formatSeconds(0),
          ruck_count: "",
          pre_dead_ball_seconds: "",
          post_dead_ball_seconds: "",
        });
      });
    });

    return rows;
  }

  function buildBipDeadBallById(snapshot) {
    const lookup = new Map();

    snapshot.tasks.forEach((task) => {
      const orderedBips = [...task.bips].sort((left, right) => {
        if (left.startElapsedMs !== right.startElapsedMs) {
          return left.startElapsedMs - right.startElapsedMs;
        }
        return String(left.id).localeCompare(String(right.id));
      });

      orderedBips.forEach((bip, index) => {
        const previousBipEndMs = index === 0 ? null : orderedBips[index - 1].effectiveEndElapsedMs;
        const nextBipStartMs =
          index === orderedBips.length - 1 ? task.effectiveEndElapsedMs : orderedBips[index + 1].startElapsedMs;
        const preDeadBallMs = index === 0
          ? Math.max(0, bip.startElapsedMs - task.startElapsedMs)
          : Math.max(0, bip.startElapsedMs - (previousBipEndMs ?? bip.startElapsedMs));
        const postDeadBallMs = Math.max(0, nextBipStartMs - bip.effectiveEndElapsedMs);

        lookup.set(bip.id, {
          pre_dead_ball_seconds: formatSeconds(preDeadBallMs),
          post_dead_ball_seconds: formatSeconds(postDeadBallMs),
        });
      });
    });

    return lookup;
  }

  function countBipRucks(task, bipId) {
    return task.rucks.filter((ruck) => ruck.bipId === bipId).length;
  }

  function triggerDownload(filename, contents, mimeType) {
    triggerBlobDownload(filename, new Blob([contents], { type: mimeType }));
  }

  function triggerBlobDownload(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
      rel: "noopener",
    });
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  function clearReviewSourceCache() {
    try {
      localStorage.removeItem(REVIEW_SOURCE_KEY);
      reviewOverlaySession = null;
    } catch (error) {
      console.error("Unable to clear review source cache", error);
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeSession(JSON.parse(raw)) : createSession();
    } catch (error) {
      console.error("Unable to load session", error);
      return createSession();
    }
  }

  function loadReviewSourceSession() {
    try {
      const raw = localStorage.getItem(REVIEW_SOURCE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      const candidate =
        parsed && typeof parsed === "object" && parsed.session && typeof parsed.session === "object"
          ? parsed.session
          : parsed;

      if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.tasks) || !candidate.tasks.length) {
        return null;
      }

      return normalizeSession(candidate);
    } catch (error) {
      console.error("Unable to load review source overlay", error);
      return null;
    }
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
      isFinished: false,
      finishedAt: null,
      tasks: [],
      events: [],
    };
  }

  function createTimePickerState() {
    return {
      open: false,
      boundary: "start",
      taskId: null,
      anchorUnixMs: 0,
      hour: 0,
      minute: 0,
      second: 0,
      syncScroll: false,
      scrollTimers: {
        hour: null,
        minute: null,
        second: null,
      },
      restoreFocusId: "",
    };
  }

  function getPersistedSession() {
    return {
      ...session,
      tasks: session.tasks.map((task) => ({
        ...task,
        bips: task.bips.map((bip) => ({ ...bip })),
        rucks: task.rucks.map((ruck) => ({ ...ruck })),
      })),
      events: session.events.map((eventItem) => ({ ...eventItem })),
    };
  }

  function normalizeSession(raw) {
    if (!raw || typeof raw !== "object") {
      return createSession();
    }

    const base = createSession();
    const nextSession = {
      sessionId: typeof raw.sessionId === "string" && raw.sessionId ? raw.sessionId : base.sessionId,
      createdAt: isValidDate(raw.createdAt) ? raw.createdAt : base.createdAt,
      activityName: typeof raw.activityName === "string" ? raw.activityName.slice(0, MAX_ACTIVITY) : base.activityName,
      currentPeriod: typeof raw.currentPeriod === "string" ? raw.currentPeriod.slice(0, MAX_PERIOD) : base.currentPeriod,
      taskNameDraft: typeof raw.taskNameDraft === "string" ? raw.taskNameDraft.slice(0, MAX_TASK) : base.taskNameDraft,
      clockState: raw.clockState === "running" ? "running" : "paused",
      elapsedMs: normMs(raw.elapsedMs),
      lastStartedAt: isValidDate(raw.lastStartedAt) ? raw.lastStartedAt : null,
      activeTaskId: typeof raw.activeTaskId === "string" ? raw.activeTaskId : null,
      activeBipId: typeof raw.activeBipId === "string" ? raw.activeBipId : null,
      isFinished: raw.isFinished === true,
      finishedAt: isValidDate(raw.finishedAt) ? raw.finishedAt : null,
      tasks: Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean) : [],
      events: Array.isArray(raw.events)
        ? raw.events.map(normalizeEvent).filter(Boolean).map((eventItem, index) => ({ ...eventItem, index: index + 1 }))
        : [],
    };

    if (nextSession.clockState === "paused") {
      nextSession.lastStartedAt = null;
    }

    if (nextSession.clockState === "running" && !nextSession.lastStartedAt) {
      nextSession.clockState = "paused";
    }

    if (nextSession.clockState === "running" && !hasValue(nextSession.activityName)) {
      nextSession.clockState = "paused";
      nextSession.lastStartedAt = null;
    }

    if (nextSession.isFinished) {
      nextSession.clockState = "paused";
      nextSession.lastStartedAt = null;
      nextSession.activeTaskId = null;
      nextSession.activeBipId = null;
    }

    if (!findTask(nextSession.tasks, nextSession.activeTaskId)) {
      nextSession.activeTaskId = null;
    }

    if (!findBip(nextSession.tasks, nextSession.activeBipId)) {
      nextSession.activeBipId = null;
    }

    return nextSession;
  }

  function normalizeTask(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      name: taskLabel(raw.name, 1),
      period: exportPeriodLabel(raw.period),
      startElapsedMs: normMs(raw.startElapsedMs),
      endElapsedMs: raw.endElapsedMs == null ? null : normMs(raw.endElapsedMs),
      createdAt: isValidDate(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      closedAt: isValidDate(raw.closedAt) ? raw.closedAt : null,
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
      label: bipLabel(raw.label, 1),
      period: exportPeriodLabel(raw.period),
      startElapsedMs: normMs(raw.startElapsedMs),
      endElapsedMs: raw.endElapsedMs == null ? null : normMs(raw.endElapsedMs),
      createdAt: isValidDate(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      closedAt: isValidDate(raw.closedAt) ? raw.closedAt : null,
    };
  }

  function normalizeRuck(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      period: exportPeriodLabel(raw.period),
      elapsedMs: normMs(raw.elapsedMs),
      createdAt: isValidDate(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      bipId: typeof raw.bipId === "string" ? raw.bipId : null,
    };
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const type = EVENT_LABELS[raw.type] ? raw.type : null;
    if (!type) {
      return null;
    }

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      index: 0,
      type,
      label: eventLabel(type, raw),
      period: exportPeriodLabel(raw.period),
      elapsedMs: normMs(raw.elapsedMs),
      createdAt: isValidDate(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      taskId: typeof raw.taskId === "string" ? raw.taskId : null,
      taskName: typeof raw.taskName === "string" ? raw.taskName : "",
      bipId: typeof raw.bipId === "string" ? raw.bipId : null,
      bipName: typeof raw.bipName === "string" ? raw.bipName : "",
    };
  }

  function appendEvent(type, elapsedMs, createdAt, meta = {}) {
    session.events.push({
      id: createId(),
      index: session.events.length + 1,
      type,
      label: typeof meta.label === "string" ? meta.label : eventLabel(type, meta),
      period: exportPeriodLabel(session.currentPeriod),
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      createdAt: createdAt.toISOString(),
      taskId: meta.taskId || null,
      taskName: meta.taskName || "",
      bipId: meta.bipId || null,
      bipName: meta.bipName || "",
    });
  }

  function getExportSnapshot() {
    const nowIso = new Date().toISOString();
    const elapsedMs = getCurrentElapsedMs();
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      exportedAt: nowIso,
      activityName: exportActivityLabel(session.activityName),
      currentPeriod: exportPeriodLabel(session.currentPeriod),
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
    const effectiveEndElapsedMs = taskEndMs(task, currentElapsedMs);
    return {
      ...task,
      effectiveEndElapsedMs,
      durationMs: Math.max(0, effectiveEndElapsedMs - task.startElapsedMs),
      bips: task.bips.map((bip) => {
        const bipEndElapsedMs = bipEndMs(bip, currentElapsedMs);
        return {
          ...bip,
          effectiveEndElapsedMs: bipEndElapsedMs,
          durationMs: Math.max(0, bipEndElapsedMs - bip.startElapsedMs),
        };
      }),
      rucks: task.rucks.map((ruck) => ({ ...ruck })),
    };
  }

  function getTaskStartUnixMs(task) {
    return toUnixMs(task.createdAt);
  }

  function getTaskEndUnixMs(task, fallbackIso) {
    return toUnixMs(task.closedAt || fallbackIso);
  }

  function getBipStartUnixMs(bip) {
    return toUnixMs(bip.createdAt);
  }

  function getBipEndUnixMs(bip, fallbackIso) {
    return toUnixMs(bip.closedAt || fallbackIso);
  }

  function getRuckUnixMs(ruck) {
    return toUnixMs(ruck.createdAt);
  }

  function getRuckTimeUnixMs(ruck) {
    return getRuckUnixMs(ruck);
  }

  function getRuckStartUnixMs(ruck) {
    const ruckTimeUnixMs = getRuckTimeUnixMs(ruck);
    const clampWindowMs = Math.min(RUCK_WINDOW_MS, normMs(ruck.elapsedMs));
    return ruckTimeUnixMs === "" ? "" : Math.max(0, ruckTimeUnixMs - clampWindowMs);
  }

  function getRuckEndUnixMs(ruck) {
    const ruckTimeUnixMs = getRuckTimeUnixMs(ruck);
    return ruckTimeUnixMs === "" ? "" : ruckTimeUnixMs + RUCK_WINDOW_MS;
  }

  function getRuckStartSeconds(ruck) {
    return formatSeconds(Math.max(0, normMs(ruck.elapsedMs) - RUCK_WINDOW_MS));
  }

  function getRuckEndSeconds(ruck) {
    return formatSeconds(normMs(ruck.elapsedMs) + RUCK_WINDOW_MS);
  }

  function getViewSnapshot() {
    const now = new Date();
    const elapsedMs = getCurrentElapsedMs(now);
    const overlayTasks = getOverlayTasksForSession();
    const tasks = session.tasks.map((task) => applyOverlayToViewTask(toViewTask(task, elapsedMs), overlayTasks.get(task.id)));
    const activeTask = tasks.find((task) => task.id === session.activeTaskId) || null;
    const activeBip = activeTask && session.activeBipId
      ? activeTask.bips.find((bip) => bip.id === session.activeBipId) || null
      : null;
    const selectedTask = normalizeSelectedTask(tasks, activeTask);
    const bipCount = tasks.reduce((sum, task) => sum + task.bips.length, 0);
    const ruckCount = tasks.reduce((sum, task) => sum + task.rucks.length, 0);
    const timelineOriginMs = getTimelineOriginMs(tasks);

    return {
      nowMs: now.getTime(),
      elapsedMs,
      clockState: session.clockState,
      activityLabel: labelActivity(session.activityName),
      periodLabel: labelPeriod(session.currentPeriod),
      hasNamedActivity: hasValue(session.activityName),
      hasNamedPeriod: hasValue(session.currentPeriod),
      isFinished: session.isFinished === true,
      nextTaskName: getNextTaskName(),
      tasks,
      events: session.events.map((eventItem) => ({ ...eventItem })),
      activeTask,
      activeBip,
      selectedTask,
      bipCount,
      ruckCount,
      timelineOriginMs,
      totalDurationMs: getTotalDuration(tasks, session.events, elapsedMs, timelineOriginMs),
      statusMessage: buildStatus({
        hasNamedActivity: hasValue(session.activityName),
        hasNamedPeriod: hasValue(session.currentPeriod),
        clockState: session.clockState,
        activeTask,
        activeBip,
        nextTaskName: getNextTaskName(),
      }),
    };
  }

  function getOverlayTasksForSession() {
    if (!reviewOverlaySession || reviewOverlaySession.sessionId !== session.sessionId) {
      return new Map();
    }

    return new Map(reviewOverlaySession.tasks.map((task) => [task.id, task]));
  }

  function applyOverlayToViewTask(task, overlayTask) {
    if (!overlayTask) {
      return task;
    }

    const keepLiveEnd = task.isActive;
    const nextStartElapsedMs =
      isTaskStartAlignedToFirstBip(overlayTask) && task.bips.length
        ? normMs(task.bips[0].startElapsedMs)
        : task.startElapsedMs;
    const nextEffectiveEndElapsedMs =
      keepLiveEnd
        ? task.effectiveEndElapsedMs
        : isTaskEndAlignedToLastBip(overlayTask) && task.bips.length
        ? Math.max(nextStartElapsedMs, normMs(task.bips[task.bips.length - 1].effectiveEndElapsedMs))
        : Math.max(nextStartElapsedMs, task.effectiveEndElapsedMs);

    return {
      ...task,
      name: typeof overlayTask.name === "string" && overlayTask.name ? overlayTask.name : task.name,
      period: typeof overlayTask.period === "string" && overlayTask.period ? overlayTask.period : task.period,
      startElapsedMs: nextStartElapsedMs,
      effectiveEndElapsedMs: nextEffectiveEndElapsedMs,
      durationMs: Math.max(0, nextEffectiveEndElapsedMs - nextStartElapsedMs),
    };
  }

  function isTaskStartAlignedToFirstBip(task) {
    return Boolean(task?.bips?.length) && normMs(task.startElapsedMs) === normMs(task.bips[0].startElapsedMs);
  }

  function isTaskEndAlignedToLastBip(task) {
    if (!task?.bips?.length) {
      return false;
    }
    const lastBip = task.bips[task.bips.length - 1];
    const taskEndElapsedMs = task.endElapsedMs == null ? normMs(lastBip.endElapsedMs) : normMs(task.endElapsedMs);
    const lastBipEndElapsedMs = lastBip.endElapsedMs == null ? taskEndElapsedMs : normMs(lastBip.endElapsedMs);
    return taskEndElapsedMs === lastBipEndElapsedMs;
  }

  function normalizeSelectedTask(tasks, activeTask) {
    if (selectionCleared) {
      return null;
    }

    if (selectedTaskId) {
      const selected = tasks.find((task) => task.id === selectedTaskId);
      if (selected) {
        return selected;
      }
    }

    if (activeTask) {
      selectedTaskId = activeTask.id;
      return activeTask;
    }

    const latestTask = tasks.at(-1) || null;
    selectedTaskId = latestTask ? latestTask.id : null;
    return latestTask;
  }

  function toViewTask(task, currentElapsedMs) {
    const effectiveEndElapsedMs = taskEndMs(task, currentElapsedMs);
    return {
      ...task,
      effectiveEndElapsedMs,
      durationMs: Math.max(0, effectiveEndElapsedMs - task.startElapsedMs),
      isActive: session.activeTaskId === task.id && task.endElapsedMs === null,
      bips: task.bips.map((bip) => {
        const effectiveBipEndElapsedMs = bipEndMs(bip, currentElapsedMs);
        return {
          ...bip,
          effectiveEndElapsedMs: effectiveBipEndElapsedMs,
          durationMs: Math.max(0, effectiveBipEndElapsedMs - bip.startElapsedMs),
          isActive: session.activeBipId === bip.id && bip.endElapsedMs === null,
        };
      }),
      rucks: task.rucks.map((ruck) => ({ ...ruck })),
    };
  }

  function renderAll() {
    const snapshot = getViewSnapshot();
    renderClock(snapshot);
    renderEditors(snapshot);
    renderTimeline(snapshot);
    renderEvents(snapshot);
    renderTimePickerModal();
    renderSaveState();
    syncButtons(snapshot);
  }

  function renderClock(snapshot = getViewSnapshot()) {
    el.clockDisplay.textContent = fmtClock(snapshot.elapsedMs);
    el.clockDisplay.classList.toggle("clock-display--running", snapshot.clockState === "running");

    el.statePill.textContent = snapshot.isFinished ? "Finished" : snapshot.clockState === "running" ? "Running" : "Paused";
    el.statePill.classList.toggle("state-pill--running", !snapshot.isFinished && snapshot.clockState === "running");
    el.statePill.classList.toggle("state-pill--paused", !snapshot.isFinished && snapshot.clockState !== "running");
    el.statePill.classList.toggle("state-pill--finished", snapshot.isFinished);

    el.activityBadge.textContent = snapshot.activityLabel;
    if (el.periodBadge) {
      el.periodBadge.textContent = snapshot.periodLabel;
    }
    el.taskBadge.textContent = snapshot.activeTask ? snapshot.activeTask.name : "No active task";
    el.bipBadge.textContent = snapshot.activeBip
      ? snapshot.activeBip.label
      : snapshot.activeTask
        ? "Task still live"
        : "No active BIP";
    el.taskBadge.closest(".badge")?.classList.toggle("badge--live", Boolean(snapshot.activeTask));
    el.bipBadge.closest(".badge")?.classList.toggle("badge--live", Boolean(snapshot.activeBip));
    el.liveStatus.textContent = snapshot.statusMessage;
  }

  function renderEditors(snapshot = getViewSnapshot()) {
    el.taskCount.textContent = String(snapshot.tasks.length);
    el.bipCount.textContent = String(snapshot.bipCount);
    el.ruckCount.textContent = String(snapshot.ruckCount);
    el.eventCount.textContent = String(snapshot.events.length);
    el.logToggleCount.textContent = String(snapshot.events.length);
    if (el.periodInput) {
      syncInput(el.periodInput, session.currentPeriod);
      el.periodInput.disabled = snapshot.isFinished;
    }
    renderFinishButton(snapshot);

    const selectedTask = snapshot.selectedTask;
    if (!selectedTask) {
      el.selectedTaskPanel.hidden = true;
      syncInput(el.selectedTaskNameInput, "");
      el.selectedTaskActionBtn.textContent = "Restart task";
      el.selectedTaskActionBtn.disabled = true;
      el.selectedTaskActionBtn.title = "Select a task first.";
      el.selectedTaskStartTime.textContent = "00:00:00";
      el.selectedTaskEndTime.textContent = "00:00:00";
      el.selectedTaskStartBtn.disabled = true;
      el.selectedTaskEndBtn.disabled = true;
      return;
    }

    el.selectedTaskPanel.hidden = false;
    el.selectedTaskPanel.dataset.state = selectedTask.isActive ? "active" : "idle";
    el.selectedTaskTitle.textContent = selectedTask.name;
    el.selectedTaskState.textContent = selectedTask.isActive ? "Live" : "Selected";
    el.selectedTaskMeta.textContent = `${selectedTask.period} · ${selectedTask.bips.length} BIPs · ${selectedTask.rucks.length} rucks`;
    syncInput(el.selectedTaskNameInput, selectedTask.name);
    el.selectedTaskStartTime.textContent = fmtMadridTime(getTaskStartUnixMs(selectedTask));
    el.selectedTaskEndTime.textContent = fmtMadridTime(
      selectedTask.isActive ? snapshot.nowMs : getTaskEndUnixMs(selectedTask, new Date(snapshot.nowMs).toISOString())
    );
    const activeTask = snapshot.activeTask;
    const restartTaskError = getRestartTaskUnavailableReason(getSelectedTaskFromSession());
    const canStopSelectedTask = selectedTask.isActive;
    const canRestartSelectedTask = !restartTaskError;
    const selectedTaskActionLabel = canStopSelectedTask ? "Stop task" : "Restart task";
    let selectedTaskActionTitle = canStopSelectedTask
      ? `Stop ${selectedTask.name}.`
      : `Restart ${selectedTask.name}.`;

    if (!canStopSelectedTask && !canRestartSelectedTask) {
      selectedTaskActionTitle = restartTaskError;
    }

    el.selectedTaskNameInput.disabled = false;
    el.selectedTaskActionBtn.textContent = selectedTaskActionLabel;
    el.selectedTaskActionBtn.disabled = !(canStopSelectedTask || canRestartSelectedTask);
    el.selectedTaskActionBtn.title = selectedTaskActionTitle;
    el.selectedTaskActionBtn.setAttribute("aria-label", selectedTaskActionLabel);
    el.selectedTaskStartBtn.disabled = snapshot.isFinished;
    el.selectedTaskEndBtn.disabled = snapshot.isFinished || selectedTask.isActive;
    el.selectedTaskStartBtn.title = "Edit start time";
    el.selectedTaskEndBtn.title = selectedTask.isActive ? "End time rolls while the task is live." : "Edit end time";
    el.deleteTaskBtn.disabled = snapshot.isFinished;
  }

  function renderFinishButton(snapshot = getViewSnapshot()) {
    if (snapshot.isFinished) {
      el.finishBtn.textContent = "Activity finished";
      el.finishBtn.dataset.state = "finished";
      el.finishBtn.disabled = true;
      return;
    }

    if (isFinishConfirmArmed()) {
      el.finishBtn.textContent = "Confirm finish";
      el.finishBtn.dataset.state = "armed";
      el.finishBtn.disabled = false;
      return;
    }

    el.finishBtn.textContent = "Finish activity";
    el.finishBtn.dataset.state = "idle";
    el.finishBtn.disabled = !snapshot.hasNamedActivity;
  }

  function renderTimeline(snapshot = getViewSnapshot()) {
    const hasTasks = snapshot.tasks.length > 0;
    el.timelineScale.innerHTML = hasTasks ? buildScale(snapshot.totalDurationMs) : "";
    el.timelineEmpty.hidden = hasTasks;
    el.timelineMap.innerHTML = hasTasks ? renderUnifiedTimeline(snapshot) : "";
  }

  function renderUnifiedTimeline(snapshot) {
    return `
      <article class="timeline-single" role="listitem">
        <div class="timeline-single__meta">
          <span class="timeline-single__label">Session timeline</span>
          <span class="timeline-single__summary">${snapshot.tasks.length} tasks · ${snapshot.bipCount} BIPs · ${snapshot.ruckCount} rucks</span>
        </div>
        <div class="timeline-stack">
          <div class="timeline-lane timeline-lane--tasks">
            ${snapshot.tasks.map((task) => renderTaskSpan(task, snapshot)).join("")}
          </div>
          <div class="timeline-lane timeline-lane--events">
            ${snapshot.tasks.flatMap((task) => task.bips.map((bip) => renderBipSpan(task, bip, snapshot))).join("")}
            ${snapshot.tasks.flatMap((task) => task.rucks.map((ruck) => renderRuckMarker(task, ruck, snapshot))).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function renderTaskSpan(task, snapshot) {
    const classes = [
      "task-span",
      task.isActive ? "task-span--active" : "",
      snapshot.selectedTask?.id === task.id ? "task-span--selected" : "",
    ].filter(Boolean).join(" ");

    return `
      <button
        class="${classes}"
        type="button"
        style="${intervalStyle(task.startElapsedMs, task.effectiveEndElapsedMs, snapshot.totalDurationMs, snapshot.timelineOriginMs)}"
        data-task-id="${esc(task.id)}"
        aria-label="${esc(task.name)}"
      >
        <span class="task-span__label">${esc(task.name)}</span>
      </button>
    `;
  }

  function renderBipSpan(task, bip, snapshot) {
    return `
      <button
        class="bip-span${bip.isActive ? " bip-span--active" : ""}"
        type="button"
        style="${intervalStyle(bip.startElapsedMs, bip.effectiveEndElapsedMs, snapshot.totalDurationMs, snapshot.timelineOriginMs)}"
        data-task-id="${esc(task.id)}"
        aria-label="${esc(`${bip.label} inside ${task.name}`)}"
      >
        <span class="bip-span__label">${esc(bip.label)}</span>
      </button>
    `;
  }

  function renderRuckMarker(task, ruck, snapshot) {
    return `
      <button
        class="ruck-marker"
        type="button"
        style="left:${toPct(Math.max(0, ruck.elapsedMs - snapshot.timelineOriginMs), snapshot.totalDurationMs)}%"
        data-task-id="${esc(task.id)}"
        aria-label="${esc(`Ruck in ${task.name} at ${fmtClock(Math.max(0, ruck.elapsedMs - snapshot.timelineOriginMs))}`)}"
      ></button>
    `;
  }

  function renderEvents(snapshot = getViewSnapshot()) {
    const hasEvents = snapshot.events.length > 0;
    el.eventsEmptyState.hidden = hasEvents;
    el.eventsList.innerHTML = hasEvents
      ? snapshot.events.slice().reverse().map((eventItem) => `
          <article class="event-row" role="listitem">
            <span class="event-type-dot event-type-dot--${esc(eventItem.type)}"></span>
            <span class="event-label">${esc(eventItem.label)}</span>
            <span class="event-elapsed">${esc(fmtClock(eventItem.elapsedMs))}</span>
          </article>
        `).join("")
      : "";
  }

  function renderSaveState() {
    if (!saveState.available) {
      el.savePill.title = "Auto-save unavailable";
      el.savePill.classList.add("save-dot--warn");
      return;
    }

    el.savePill.classList.remove("save-dot--warn");
    el.savePill.title = saveState.lastSavedAt
      ? `Saved ${fmtTime(saveState.lastSavedAt.toISOString())}`
      : "Auto-save ready";
  }

  function syncButtons(snapshot = getViewSnapshot()) {
    const running = snapshot.clockState === "running";
    const hasTask = Boolean(snapshot.activeTask);
    const hasBip = Boolean(snapshot.activeBip);
    const locked = snapshot.isFinished;

    el.playBtn.disabled = locked || running;
    el.pauseBtn.disabled = locked || !running;
    el.taskBtn.disabled = locked || (hasTask ? false : !running);
    el.bipBtn.disabled = locked || !hasTask || (!running && !hasBip);
    el.ruckBtn.disabled = locked || !running || !hasTask;

    el.taskBtnLabel.textContent = hasTask ? "T■" : "T+";
    el.taskBtn.dataset.active = hasTask ? "true" : "false";
    el.taskBtnIcon.innerHTML = hasTask ? ICON_TASK_STOP : ICON_TASK_ADD;

    el.bipBtnLabel.textContent = hasBip ? "B■" : "BIP";
    el.bipBtn.dataset.active = hasBip ? "true" : "false";
    el.bipBtnIcon.innerHTML = hasBip ? ICON_BIP_STOP : ICON_BIP_START;
  }

  function syncClockTimer() {
    const shouldRun = session.clockState === "running";
    if (shouldRun && !tickTimer) {
      tickTimer = window.setInterval(() => {
        const snapshot = getViewSnapshot();
        renderClock(snapshot);
        renderEditors(snapshot);
        renderTimeline(snapshot);
      }, CLOCK_TICK_MS);
      return;
    }

    if (!shouldRun && tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function getActiveTask() {
    return findTask(session.tasks, session.activeTaskId);
  }

  function getActiveBip() {
    return findBip(session.tasks, session.activeBipId);
  }

  function getSelectedTaskFromSession() {
    return findTask(session.tasks, selectedTaskId);
  }

  function getRestartTaskUnavailableReason(task) {
    if (!task) {
      return "Select a task first.";
    }

    if (session.isFinished) {
      return "Finished activities cannot restart tasks.";
    }

    if (session.activeTaskId) {
      const activeTask = getActiveTask();
      return activeTask
        ? `Stop ${activeTask.name} before restarting another task.`
        : "Stop the live task before restarting another task.";
    }

    if (session.clockState !== "running") {
      return "Press Play to restart the clock before restarting the task.";
    }

    if (session.tasks.at(-1)?.id !== task.id) {
      return "Only the most recent task can be restarted.";
    }

    return "";
  }

  function findTask(tasks, taskId) {
    if (!taskId) {
      return null;
    }
    return tasks.find((task) => task.id === taskId) || null;
  }

  function findBip(tasks, bipId) {
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

  function getCurrentElapsedMs(now = new Date()) {
    const baseElapsedMs = normMs(session.elapsedMs);
    if (session.clockState !== "running" || !session.lastStartedAt) {
      return baseElapsedMs;
    }

    const startedAtMs = Date.parse(session.lastStartedAt);
    return Number.isFinite(startedAtMs) ? baseElapsedMs + Math.max(0, now.getTime() - startedAtMs) : baseElapsedMs;
  }

  function taskEndMs(task, currentElapsedMs) {
    return task.endElapsedMs === null ? currentElapsedMs : task.endElapsedMs;
  }

  function bipEndMs(bip, currentElapsedMs) {
    return bip.endElapsedMs === null ? currentElapsedMs : bip.endElapsedMs;
  }

  function getTimelineOriginMs(tasks) {
    if (!tasks.length) {
      return 0;
    }

    return tasks.reduce(
      (minValue, task) => Math.min(minValue, normMs(task.startElapsedMs)),
      normMs(tasks[0].startElapsedMs)
    );
  }

  function getTotalDuration(tasks, events, elapsedMs, originMs = 0) {
    let maxValue = Math.max(normMs(originMs) + 1, elapsedMs);

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

    return Math.max(1, maxValue - normMs(originMs));
  }

  function getNextTaskName() {
    return taskLabel("", session.tasks.length + 1);
  }

  function getTaskOrdinal(taskId) {
    const index = session.tasks.findIndex((task) => task.id === taskId);
    return index >= 0 ? index + 1 : session.tasks.length + 1;
  }

  function taskLabel(value, fallbackIndex) {
    const text = String(value || "").trim();
    return text || `Task ${fallbackIndex}`;
  }

  function bipLabel(value, fallbackIndex) {
    const text = String(value || "").trim();
    return text || `BIP ${fallbackIndex}`;
  }

  function labelActivity(value) {
    const text = String(value || "").trim();
    return text || PROMPT_ACTIVITY;
  }

  function labelPeriod(value) {
    const text = String(value || "").trim();
    return text || PROMPT_PERIOD;
  }

  function exportActivityLabel(value) {
    const text = String(value || "").trim();
    return text || DEFAULT_ACTIVITY;
  }

  function exportPeriodLabel(value) {
    const text = String(value || "").trim();
    return text || EXPORT_PERIOD;
  }

  function hasValue(value) {
    return Boolean(String(value || "").trim());
  }

  function eventLabel(type, meta) {
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

    return EVENT_LABELS[type] || "Event";
  }

  function getBipName(task, bipId) {
    if (!bipId) {
      return "";
    }
    const bip = task.bips.find((item) => item.id === bipId);
    return bip ? bip.label : "";
  }

  function buildStatus({ hasNamedActivity, hasNamedPeriod, clockState, activeTask, activeBip, nextTaskName }) {
    if (session.isFinished) {
      return "Activity finished. ZIP downloaded. Start a new activity or reset.";
    }

    if (!hasNamedActivity) {
      return "Press Play to name and start the activity.";
    }

    if (clockState !== "running") {
      return "Activity locked. Press Play to resume the clock.";
    }

    if (activeTask && activeBip) {
      return `${activeTask.name} is live. ${activeBip.label} is active inside it.`;
    }

    if (activeTask) {
      return `${activeTask.name} is still live. Start the next BIP when the ball is back in play.`;
    }

    return `Press T+ to start ${nextTaskName}.`;
  }

  function syncInput(input, value) {
    if (input.value !== value) {
      input.value = value;
    }
  }

  function announce(message) {
    el.srStatus.textContent = message;
  }

  function intervalStyle(startElapsedMs, endElapsedMs, totalDurationMs, originMs = 0) {
    const safeOrigin = Math.max(0, normMs(originMs));
    const safeStart = Math.max(0, startElapsedMs - safeOrigin);
    const safeEnd = Math.max(safeStart, endElapsedMs - safeOrigin);
    return `left:${toPct(safeStart, totalDurationMs)}%;width:${Math.max(toPct(safeEnd - safeStart, totalDurationMs), 1.4)}%`;
  }

  function toPct(value, total) {
    return !Number.isFinite(total) || total <= 0 ? 0 : (Math.max(0, value) / total) * 100;
  }

  function buildScale(totalDurationMs) {
    return Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return `<div class="timeline-scale__item"><span class="timeline-scale__label">${esc(fmtClock(totalDurationMs * ratio))}</span></div>`;
    }).join("");
  }

  function fmtClock(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(Number(totalMs || 0) / 1000));
    return `${pad2(Math.floor(totalSeconds / 3600))}:${pad2(Math.floor((totalSeconds % 3600) / 60))}:${pad2(totalSeconds % 60)}`;
  }

  function fmtTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "--:--"
      : new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(date);
  }

  function fmtMadridTime(value) {
    const unixMs = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(unixMs) ? MADRID_TIME_FORMATTER.format(new Date(unixMs)) : "--:--:--";
  }

  function fmtMadridDate(value) {
    const unixMs = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(unixMs) ? MADRID_DATE_LABEL_FORMATTER.format(new Date(unixMs)) : "";
  }

  function buildFilenameBase(activityName, isoDate) {
    const date = new Date(isoDate);
    return `${slugify(activityName)}-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  }

  function slugify(value) {
    const base = String(value || DEFAULT_ACTIVITY)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || "activity";
  }

  function toUnixMs(value) {
    const unixMs = Date.parse(value);
    return Number.isFinite(unixMs) ? unixMs : "";
  }

  function formatSeconds(value) {
    return (normMs(value) / 1000).toFixed(2);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function pad2(value) {
    return String(Math.max(0, Math.trunc(value))).padStart(2, "0");
  }

  function normMs(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
  }

  function esc(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isValidDate(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function createId() {
    return window.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  }

  function sessionHasProgress() {
    return (
      hasValue(session.activityName) ||
      hasValue(session.currentPeriod) ||
      session.elapsedMs > 0 ||
      session.tasks.length > 0 ||
      session.events.length > 0
    );
  }

  function isFinishConfirmArmed() {
    return finishConfirmExpiresAt > Date.now();
  }

  function armFinishConfirm() {
    finishConfirmExpiresAt = Date.now() + 4000;
    if (finishConfirmTimer) {
      window.clearTimeout(finishConfirmTimer);
    }
    finishConfirmTimer = window.setTimeout(() => {
      clearFinishConfirm(false);
      renderAll();
    }, 4000);
  }

  function clearFinishConfirm(shouldRender = true) {
    finishConfirmExpiresAt = 0;
    if (finishConfirmTimer) {
      window.clearTimeout(finishConfirmTimer);
      finishConfirmTimer = null;
    }
    if (shouldRender) {
      renderAll();
    }
  }

  function buildZipBlob(folderName, files) {
    const dos = toDosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    const entries = [
      { name: `${folderName}/`, bytes: new Uint8Array(0), isDirectory: true },
      ...files.map((file) => ({
        ...file,
        name: file.name.startsWith(`${folderName}/`) ? file.name : `${folderName}/${file.name}`,
      })),
    ];

    for (const entry of entries) {
      const nameBytes = zipEncoder.encode(entry.name);
      const dataBytes = entry.bytes;
      const crc = entry.isDirectory ? 0 : crc32(dataBytes);
      const size = dataBytes.length;
      const localHeader = createLocalZipHeader(nameBytes, crc, size, dos);
      localParts.push(localHeader, nameBytes, dataBytes);

      const centralHeader = createCentralZipHeader(nameBytes, crc, size, dos, offset, entry.isDirectory === true);
      centralParts.push(centralHeader, nameBytes);
      offset += localHeader.length + nameBytes.length + dataBytes.length;
    }

    const centralSize = byteLength(centralParts);
    const endRecord = createZipEndRecord(entries.length, centralSize, offset);
    return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
  }

  function createLocalZipHeader(nameBytes, crc, size, dos) {
    const buffer = new ArrayBuffer(30);
    const view = new DataView(buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dos.time, true);
    view.setUint16(12, dos.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    return new Uint8Array(buffer);
  }

  function createCentralZipHeader(nameBytes, crc, size, dos, offset, isDirectory) {
    const buffer = new ArrayBuffer(46);
    const view = new DataView(buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dos.time, true);
    view.setUint16(14, dos.date, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, isDirectory ? 16 : 0, true);
    view.setUint32(42, offset, true);
    return new Uint8Array(buffer);
  }

  function createZipEndRecord(entryCount, centralSize, centralOffset) {
    const buffer = new ArrayBuffer(22);
    const view = new DataView(buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
    return new Uint8Array(buffer);
  }

  function toDosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980);
    return {
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    };
  }

  function byteLength(parts) {
    return parts.reduce((total, part) => total + part.length, 0);
  }

  function buildCrcTable() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
})();
