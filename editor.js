(() => {
  const EXPORT_COLUMNS = [
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

  const RUCK_WINDOW_MS = 1500;
  const MAX_TASK_NAME = 64;
  const DEFAULT_ACTIVITY = "Imported activity";
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const crcTable = buildCrcTable();

  const el = {
    editorTopActivity: document.getElementById("editorTopActivity"),
    editorTopStatus: document.getElementById("editorTopStatus"),
    editorTitle: document.getElementById("editorTitle"),
    editorMetaSource: document.getElementById("editorMetaSource"),
    editorMetaWindow: document.getElementById("editorMetaWindow"),
    editorFileInput: document.getElementById("editorFileInput"),
    editorExportCsvBtn: document.getElementById("editorExportCsvBtn"),
    editorExportJsonBtn: document.getElementById("editorExportJsonBtn"),
    editorExportZipBtn: document.getElementById("editorExportZipBtn"),
    editorKpiTasks: document.getElementById("editorKpiTasks"),
    editorKpiBips: document.getElementById("editorKpiBips"),
    editorKpiRucks: document.getElementById("editorKpiRucks"),
    editorKpiWindow: document.getElementById("editorKpiWindow"),
    editorKpiRows: document.getElementById("editorKpiRows"),
    alignStartAllBtn: document.getElementById("alignStartAllBtn"),
    alignEndAllBtn: document.getElementById("alignEndAllBtn"),
    alignBothAllBtn: document.getElementById("alignBothAllBtn"),
    editorSelectedTaskHint: document.getElementById("editorSelectedTaskHint"),
    editorSelectionEmpty: document.getElementById("editorSelectionEmpty"),
    editorTaskForm: document.getElementById("editorTaskForm"),
    editorTaskNameInput: document.getElementById("editorTaskNameInput"),
    editorTaskStartInput: document.getElementById("editorTaskStartInput"),
    editorTaskEndInput: document.getElementById("editorTaskEndInput"),
    editorTaskMeta: document.getElementById("editorTaskMeta"),
    alignSelectedStartBtn: document.getElementById("alignSelectedStartBtn"),
    alignSelectedEndBtn: document.getElementById("alignSelectedEndBtn"),
    alignSelectedBothBtn: document.getElementById("alignSelectedBothBtn"),
    editorTimelineSummary: document.getElementById("editorTimelineSummary"),
    editorTimelineEmpty: document.getElementById("editorTimelineEmpty"),
    editorTimelineWrap: document.getElementById("editorTimelineWrap"),
    editorTimelineScale: document.getElementById("editorTimelineScale"),
    editorTimelineMap: document.getElementById("editorTimelineMap"),
    editorTaskSummary: document.getElementById("editorTaskSummary"),
    editorTableEmpty: document.getElementById("editorTableEmpty"),
    editorTableWrap: document.getElementById("editorTableWrap"),
    editorTaskTableBody: document.getElementById("editorTaskTableBody"),
    editorSrStatus: document.getElementById("editorSrStatus"),
    importSurface: document.querySelector(".editor-import"),
  };

  let state = createEditorState();

  bindEvents();
  renderAll();

  function bindEvents() {
    el.editorFileInput.addEventListener("change", handleFileInput);
    el.editorExportCsvBtn.addEventListener("click", exportCsv);
    el.editorExportJsonBtn.addEventListener("click", exportJson);
    el.editorExportZipBtn.addEventListener("click", exportBundleZip);
    el.alignStartAllBtn.addEventListener("click", () => applyAlignment("start", "all"));
    el.alignEndAllBtn.addEventListener("click", () => applyAlignment("end", "all"));
    el.alignBothAllBtn.addEventListener("click", () => applyAlignment("both", "all"));
    el.alignSelectedStartBtn.addEventListener("click", () => applyAlignment("start", "selected"));
    el.alignSelectedEndBtn.addEventListener("click", () => applyAlignment("end", "selected"));
    el.alignSelectedBothBtn.addEventListener("click", () => applyAlignment("both", "selected"));
    el.editorTaskNameInput.addEventListener("input", handleTaskNameInput);
    el.editorTaskStartInput.addEventListener("change", () => handleTaskBoundaryInput("start"));
    el.editorTaskEndInput.addEventListener("change", () => handleTaskBoundaryInput("end"));
    el.editorTimelineMap.addEventListener("click", handleTaskSelect);
    el.editorTaskTableBody.addEventListener("click", handleTaskSelect);

    if (el.importSurface) {
      el.importSurface.addEventListener("dragover", (event) => {
        event.preventDefault();
        el.importSurface.classList.add("editor-import--dragover");
      });
      el.importSurface.addEventListener("dragleave", () => {
        el.importSurface.classList.remove("editor-import--dragover");
      });
      el.importSurface.addEventListener("drop", (event) => {
        event.preventDefault();
        el.importSurface.classList.remove("editor-import--dragover");
        const [file] = Array.from(event.dataTransfer?.files || []);
        if (file) {
          loadImportFile(file);
        }
      });
    }
  }

  async function handleFileInput(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) {
      return;
    }
    await loadImportFile(file);
    event.target.value = "";
  }

  async function loadImportFile(file) {
    try {
      const payload = await parseImportFile(file);
      state = buildEditorState(payload, file.name);
      renderAll();
      announce(`${file.name} imported into Editor.`);
    } catch (error) {
      console.error("Unable to import file", error);
      announce(error instanceof Error ? error.message : "Unable to import file.");
    }
  }

  async function parseImportFile(file) {
    const filename = String(file.name || "import").toLowerCase();
    if (filename.endsWith(".zip")) {
      return parseZipPayload(await file.arrayBuffer());
    }
    if (filename.endsWith(".json")) {
      return parseJsonPayload(await file.text());
    }
    if (filename.endsWith(".csv")) {
      return parseCsvPayload(await file.text());
    }
    throw new Error("Unsupported file type. Load a CSV, JSON, or ZIP export.");
  }

  function parseJsonPayload(text) {
    const raw = JSON.parse(text);
    if (raw && Array.isArray(raw.rows)) {
      return {
        activityId: toText(raw.activity_id),
        activityName: toText(raw.activity_name),
        exportedAtIso: toText(raw.exported_at_iso),
        rows: raw.rows.map((row) => normalizeRowShape(row)),
      };
    }
    if (Array.isArray(raw)) {
      return { rows: raw.map((row) => normalizeRowShape(row)) };
    }
    throw new Error("JSON import must contain a rows array from an exported session.");
  }

  function parseCsvPayload(text) {
    const records = parseCsv(text);
    if (records.length < 2) {
      throw new Error("CSV import is empty.");
    }
    const [headers, ...rows] = records;
    const normalizedHeaders = headers.map((header) => String(header || "").trim());
    return {
      rows: rows
        .filter((row) => row.some((value) => String(value || "").trim() !== ""))
        .map((row) => {
          const entry = {};
          normalizedHeaders.forEach((header, index) => {
            entry[header] = row[index] ?? "";
          });
          return normalizeRowShape(entry);
        }),
    };
  }

  function parseZipPayload(arrayBuffer) {
    const entries = parseZipEntries(arrayBuffer);
    const candidate = [...entries].sort((left, right) => {
      const leftScore = left.name.endsWith(".json") ? 0 : left.name.endsWith(".csv") ? 1 : 2;
      const rightScore = right.name.endsWith(".json") ? 0 : right.name.endsWith(".csv") ? 1 : 2;
      return leftScore - rightScore;
    }).find((entry) => entry.name.endsWith(".json") || entry.name.endsWith(".csv"));

    if (!candidate) {
      throw new Error("ZIP import needs an exported JSON or CSV file inside the bundle.");
    }

    const text = textDecoder.decode(candidate.bytes);
    return candidate.name.endsWith(".json") ? parseJsonPayload(text) : parseCsvPayload(text);
  }

  function parseZipEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const entries = [];
    let offset = 0;

    while (offset + 30 <= bytes.length) {
      const signature = view.getUint32(offset, true);
      if (signature !== 0x04034b50) {
        break;
      }

      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLength + extraLength;
      const dataEnd = dataStart + compressedSize;

      if (compressionMethod !== 0) {
        throw new Error("Only ZIP bundles exported by the logger are supported.");
      }

      if (dataEnd > bytes.length) {
        throw new Error("ZIP import is truncated.");
      }

      const name = textDecoder.decode(bytes.slice(nameStart, nameStart + nameLength));
      if (!name.endsWith("/")) {
        entries.push({ name, bytes: bytes.slice(dataStart, dataEnd) });
      }
      offset = dataEnd;
    }

    return entries;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inQuotes) {
        if (char === "\"") {
          if (text[index + 1] === "\"") {
            value += "\"";
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          value += char;
        }
        continue;
      }

      if (char === "\"") {
        inQuotes = true;
        continue;
      }

      if (char === ",") {
        row.push(value);
        value = "";
        continue;
      }

      if (char === "\n") {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
        continue;
      }

      if (char === "\r") {
        continue;
      }

      value += char;
    }

    row.push(value);
    rows.push(row);
    return rows;
  }

  function buildEditorState(payload, sourceName) {
    const rows = Array.isArray(payload.rows)
      ? payload.rows.filter((row) => ["task", "bip", "ruck"].includes(toText(row.entity_type)))
      : [];

    if (!rows.length) {
      throw new Error("Import contains no task, BIP, or ruck rows.");
    }

    const tasksById = new Map();
    const taskRows = rows.filter((row) => row.entity_type === "task");
    const bipRows = rows.filter((row) => row.entity_type === "bip");
    const ruckRows = rows.filter((row) => row.entity_type === "ruck");

    taskRows.forEach((row, index) => {
      const taskId = toText(row.task_id) || createId();
      tasksById.set(taskId, {
        id: taskId,
        name: taskName(toText(row.task_name), index + 1),
        startMs: optionalSecondsValue(row.start_time_seconds),
        endMs: optionalSecondsValue(row.end_time_seconds),
        startUnixMs: unixValue(row.start_time_unix_ms),
        endUnixMs: unixValue(row.end_time_unix_ms),
        bips: [],
        rucks: [],
      });
    });

    bipRows.forEach((row) => {
      const taskId = toText(row.task_id) || createId();
      const task = ensureImportedTask(tasksById, taskId, row);
      task.bips.push({
        id: toText(row.bip_id) || createId(),
        label: bipLabel(toText(row.bip_name), task.bips.length + 1),
        startMs: secondsValue(row.start_time_seconds),
        endMs: secondsValue(row.end_time_seconds),
        startUnixMs: unixValue(row.start_time_unix_ms),
        endUnixMs: unixValue(row.end_time_unix_ms),
      });
    });

    ruckRows.forEach((row) => {
      const taskId = toText(row.task_id) || createId();
      const task = ensureImportedTask(tasksById, taskId, row);
      task.rucks.push({
        id: toText(row.ruck_id) || createId(),
        bipId: toText(row.bip_id) || "",
        timeMs: secondsValue(row.ruck_time_seconds || row.start_time_seconds),
        timeUnixMs: unixValue(row.ruck_time_unix_ms || row.start_time_unix_ms),
      });
    });

    const orderedTasks = [...tasksById.values()]
      .map((task, index) => finalizeImportedTask(task, index + 1))
      .sort((left, right) => {
        if (left.startMs !== right.startMs) {
          return left.startMs - right.startMs;
        }
        return left.name.localeCompare(right.name);
      });

    if (!orderedTasks.length) {
      throw new Error("Import does not contain usable task rows.");
    }

    const originUnixMs = deriveOriginUnixMs(rows, orderedTasks);
    orderedTasks.forEach((task) => syncTaskUnixBounds(task, originUnixMs));

    return {
      activityId: firstNonEmpty(payload.activityId, rows[0].activity_id, createId()),
      activityName: firstNonEmpty(payload.activityName, rows[0].activity_name, DEFAULT_ACTIVITY),
      sourceName,
      sourceType: sourceName.split(".").pop()?.toUpperCase() || "FILE",
      importedAtIso: new Date().toISOString(),
      exportedAtIso: firstNonEmpty(payload.exportedAtIso, ""),
      rowCount: rows.length,
      tasks: orderedTasks,
      selectedTaskId: orderedTasks[0]?.id || null,
      originUnixMs,
      dirty: false,
    };
  }

  function ensureImportedTask(tasksById, taskId, row) {
    if (!tasksById.has(taskId)) {
      tasksById.set(taskId, {
        id: taskId,
        name: taskName(toText(row.task_name), tasksById.size + 1),
        startMs: null,
        endMs: null,
        startUnixMs: "",
        endUnixMs: "",
        bips: [],
        rucks: [],
      });
    }
    return tasksById.get(taskId);
  }

  function finalizeImportedTask(task, fallbackIndex) {
    const orderedBips = [...task.bips].sort((left, right) => {
      if (left.startMs !== right.startMs) {
        return left.startMs - right.startMs;
      }
      return left.label.localeCompare(right.label);
    });
    const orderedRucks = [...task.rucks].sort((left, right) => left.timeMs - right.timeMs);
    const firstBip = orderedBips[0] || null;
    const lastBip = orderedBips[orderedBips.length - 1] || null;
    const startMs = task.startMs == null ? (firstBip ? firstBip.startMs : 0) : task.startMs;
    const derivedEndMs = task.endMs == null ? (lastBip ? lastBip.endMs : startMs) : task.endMs;
    const endMs = Math.max(startMs, derivedEndMs);

    return {
      ...task,
      name: taskName(task.name, fallbackIndex),
      startMs,
      endMs,
      bips: orderedBips,
      rucks: orderedRucks,
    };
  }

  function deriveOriginUnixMs(rows, tasks) {
    const candidates = [];

    rows.forEach((row) => {
      const startUnix = unixValue(row.start_time_unix_ms);
      const startSeconds = optionalSecondsValue(row.start_time_seconds);
      if (startUnix !== "" && startSeconds != null) {
        candidates.push(startUnix - startSeconds);
      }

      const ruckUnix = unixValue(row.ruck_time_unix_ms);
      const ruckSeconds = optionalSecondsValue(row.ruck_time_seconds);
      if (ruckUnix !== "" && ruckSeconds != null) {
        candidates.push(ruckUnix - ruckSeconds);
      }
    });

    if (candidates.length) {
      candidates.sort((left, right) => left - right);
      return Math.round(candidates[Math.floor(candidates.length / 2)]);
    }

    const firstTaskUnix = tasks.find((task) => task.startUnixMs !== "")?.startUnixMs;
    if (firstTaskUnix !== undefined && firstTaskUnix !== "") {
      return Math.round(firstTaskUnix - tasks[0].startMs);
    }

    return Date.now();
  }

  function handleTaskSelect(event) {
    const target = event.target.closest("[data-task-id]");
    if (!target) {
      return;
    }
    const taskId = target.getAttribute("data-task-id");
    if (!taskId) {
      return;
    }
    state.selectedTaskId = taskId;
    renderAll();
  }

  function handleTaskNameInput(event) {
    const task = selectedTask();
    if (!task) {
      return;
    }
    task.name = taskName(event.target.value, taskIndex(task.id) + 1).slice(0, MAX_TASK_NAME);
    state.dirty = true;
    renderAll();
  }

  function handleTaskBoundaryInput(boundary) {
    const task = selectedTask();
    if (!task) {
      return;
    }

    const sourceInput = boundary === "start" ? el.editorTaskStartInput : el.editorTaskEndInput;
    const nextMs = numberInputToMs(sourceInput.value);
    if (nextMs == null) {
      renderSelectedTaskPanel();
      return;
    }

    if (boundary === "start") {
      task.startMs = clampTaskStart(task, nextMs);
    } else {
      task.endMs = clampTaskEnd(task, nextMs);
    }

    syncTaskUnixBounds(task, state.originUnixMs);
    sortTasks();
    state.dirty = true;
    renderAll();
  }

  function applyAlignment(mode, scope) {
    const tasks = scope === "selected" ? [selectedTask()].filter(Boolean) : state.tasks;
    let changedCount = 0;

    tasks.forEach((task) => {
      if (!task || !task.bips.length) {
        return;
      }

      if (mode === "start" || mode === "both") {
        task.startMs = task.bips[0].startMs;
      }

      if (mode === "end" || mode === "both") {
        task.endMs = task.bips[task.bips.length - 1].endMs;
      }

      syncTaskUnixBounds(task, state.originUnixMs);
      changedCount += 1;
    });

    if (!changedCount) {
      announce("No tasks with BIPs available for alignment.");
      return;
    }

    sortTasks();
    state.dirty = true;
    renderAll();
    announce(`${changedCount} task${changedCount === 1 ? "" : "s"} aligned to BIP bounds.`);
  }

  function renderAll() {
    renderHeader();
    renderKpis();
    renderSelectedTaskPanel();
    renderTimeline();
    renderTaskTable();
    syncExportButtons();
  }

  function renderHeader() {
    const hasData = state.tasks.length > 0;
    const status = !hasData ? "Idle" : state.dirty ? "Edited" : "Loaded";

    document.title = hasData ? `${state.activityName} — BIP Editor` : "BIP Editor";
    el.editorTopActivity.textContent = hasData ? state.activityName : "Import export file";
    el.editorTopStatus.textContent = status;
    el.editorTopStatus.classList.toggle("state-pill--running", status === "Loaded");
    el.editorTopStatus.classList.toggle("state-pill--paused", status === "Idle");
    el.editorTopStatus.classList.toggle("state-pill--finished", status === "Edited");

    el.editorTitle.textContent = hasData ? state.activityName : "No imported session yet";
    el.editorMetaSource.textContent = hasData
      ? `${state.sourceName} · ${state.sourceType} · ${state.rowCount} flat rows`
      : "Load a CSV, JSON, or ZIP export from the logger.";
    el.editorMetaWindow.textContent = hasData
      ? `${state.tasks.length} tasks · ${totalBips()} BIPs · ${totalRucks()} rucks · imported ${formatReviewDate(state.importedAtIso)}`
      : "Task timing edits stay in the editor until you export again.";
  }

  function renderKpis() {
    el.editorKpiTasks.textContent = String(state.tasks.length);
    el.editorKpiBips.textContent = String(totalBips());
    el.editorKpiRucks.textContent = String(totalRucks());
    el.editorKpiWindow.textContent = formatCompactDuration(totalWindowMs());
    el.editorKpiRows.textContent = String(state.rowCount || 0);
  }

  function renderSelectedTaskPanel() {
    const task = selectedTask();
    const hasTask = Boolean(task);

    el.editorSelectionEmpty.hidden = hasTask;
    el.editorTaskForm.hidden = !hasTask;
    el.editorSelectedTaskHint.textContent = hasTask
      ? `${task.bips.length} BIPs · ${task.rucks.length} rucks · ${formatCompactDuration(taskDurationMs(task))}`
      : "Select a task from the timeline or the table.";

    if (!hasTask) {
      return;
    }

    const firstBip = task.bips[0];
    const lastBip = task.bips[task.bips.length - 1];
    el.editorTaskMeta.textContent = task.bips.length
      ? `First BIP ${formatSeconds(task.bips[0].startMs)}s · Last BIP ${formatSeconds(lastBip.endMs)}s`
      : "This task has no BIPs, so timing is fully manual.";

    syncInputValue(el.editorTaskNameInput, task.name);
    syncInputValue(el.editorTaskStartInput, formatSeconds(task.startMs));
    syncInputValue(el.editorTaskEndInput, formatSeconds(task.endMs));
  }

  function renderTimeline() {
    if (!state.tasks.length) {
      el.editorTimelineEmpty.hidden = false;
      el.editorTimelineWrap.hidden = true;
      el.editorTimelineScale.innerHTML = "";
      el.editorTimelineMap.innerHTML = "";
      el.editorTimelineSummary.textContent = "The timeline appears after import.";
      return;
    }

    const totalMs = Math.max(1, ...state.tasks.flatMap((task) => {
      const values = [task.endMs];
      task.bips.forEach((bip) => values.push(bip.endMs));
      task.rucks.forEach((ruck) => values.push(ruck.timeMs));
      return values;
    }));

    el.editorTimelineEmpty.hidden = true;
    el.editorTimelineWrap.hidden = false;
    el.editorTimelineScale.innerHTML = buildScale(totalMs);
    el.editorTimelineMap.innerHTML = state.tasks.map((task) => renderTimelineRow(task, totalMs)).join("");
    el.editorTimelineSummary.textContent = `${state.tasks.length} tasks across ${formatCompactDuration(totalWindowMs())}. Click a task row to edit its bounds.`;
  }

  function renderTimelineRow(task, totalMs) {
    const isSelected = task.id === state.selectedTaskId;
    return `
      <article class="editor-track-row${isSelected ? " editor-track-row--selected" : ""}" role="listitem">
        <button class="editor-track-row__meta" type="button" data-task-id="${esc(task.id)}">
          <span class="editor-track-row__name">${esc(task.name)}</span>
          <span class="editor-track-row__stats">${esc(formatSeconds(task.startMs))}s → ${esc(formatSeconds(task.endMs))}s · ${task.bips.length} BIPs · ${task.rucks.length} rucks</span>
        </button>
        <div class="editor-track-row__lane timeline-lane">
          <button
            class="task-span${isSelected ? " task-span--selected" : ""}"
            type="button"
            style="${intervalStyle(task.startMs, task.endMs, totalMs)}"
            data-task-id="${esc(task.id)}"
            aria-label="${esc(task.name)}"
          >
            <span class="task-span__label">${esc(task.name)}</span>
          </button>
          ${task.bips.map((bip) => `
            <span
              class="bip-span"
              style="${intervalStyle(bip.startMs, bip.endMs, totalMs)}"
              aria-hidden="true"
            >
              <span class="bip-span__label">${esc(bip.label)}</span>
            </span>
          `).join("")}
          ${task.rucks.map((ruck) => `
            <span
              class="ruck-marker"
              style="left:${toPercent(ruck.timeMs, totalMs)}%;"
              aria-hidden="true"
            ></span>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderTaskTable() {
    if (!state.tasks.length) {
      el.editorTableEmpty.hidden = false;
      el.editorTableWrap.hidden = true;
      el.editorTaskSummary.textContent = "Import a session to populate the table.";
      el.editorTaskTableBody.innerHTML = "";
      return;
    }

    el.editorTableEmpty.hidden = true;
    el.editorTableWrap.hidden = false;
    el.editorTaskSummary.textContent = `${state.tasks.length} tasks · ${totalBips()} BIPs · ${totalRucks()} rucks. Editing updates the next export only.`;
    el.editorTaskTableBody.innerHTML = state.tasks
      .map((task) => {
        const isSelected = task.id === state.selectedTaskId;
        return `
          <tr class="${isSelected ? "editor-table__row--selected" : ""}">
            <td>
              <div class="review-table__task">
                <div class="review-table__task-title">
                  <span class="review-badge${task.bips.length ? "" : " review-badge--live"}">${task.bips.length ? "Task" : "Manual"}</span>
                  <span>${esc(task.name)}</span>
                </div>
                <div class="review-table__task-meta">${task.bips.length ? `${task.bips.length} BIPs` : "No BIPs"} · ${task.rucks.length} rucks</div>
              </div>
            </td>
            <td class="review-table__metric">${esc(formatSeconds(task.startMs))}s</td>
            <td class="review-table__metric">${esc(formatSeconds(task.endMs))}s</td>
            <td class="review-table__metric review-table__metric--accent">${esc(formatSeconds(taskDurationMs(task)))}s</td>
            <td>${task.bips.length}</td>
            <td>${task.rucks.length}</td>
            <td><button class="aux-btn aux-btn--table" type="button" data-task-id="${esc(task.id)}">${isSelected ? "Editing" : "Edit"}</button></td>
          </tr>
        `;
      })
      .join("");
  }

  function exportCsv() {
    if (!state.tasks.length) {
      announce("Import a file before exporting.");
      return;
    }

    const snapshot = buildExportSnapshot();
    triggerDownload(
      `${buildFilenameBase(snapshot.activity_name, snapshot.exported_at_iso)}.csv`,
      buildCsvContent(snapshot),
      "text/csv;charset=utf-8"
    );
    state.dirty = false;
    renderHeader();
    announce("Edited CSV exported.");
  }

  function exportJson() {
    if (!state.tasks.length) {
      announce("Import a file before exporting.");
      return;
    }

    const snapshot = buildExportSnapshot();
    triggerDownload(
      `${buildFilenameBase(snapshot.activity_name, snapshot.exported_at_iso)}.json`,
      buildJsonContent(snapshot),
      "application/json;charset=utf-8"
    );
    state.dirty = false;
    renderHeader();
    announce("Edited JSON exported.");
  }

  function exportBundleZip() {
    if (!state.tasks.length) {
      announce("Import a file before exporting.");
      return;
    }

    const snapshot = buildExportSnapshot();
    const base = buildFilenameBase(snapshot.activity_name, snapshot.exported_at_iso);
    const zipBlob = buildZipBlob(base, [
      { name: `${base}.csv`, bytes: textEncoder.encode(buildCsvContent(snapshot)) },
      { name: `${base}.json`, bytes: textEncoder.encode(buildJsonContent(snapshot)) },
    ]);
    triggerBlobDownload(`${base}.zip`, zipBlob);
    state.dirty = false;
    renderHeader();
    announce("Edited ZIP exported.");
  }

  function buildExportSnapshot() {
    return {
      activity_id: state.activityId,
      activity_name: state.activityName,
      exported_at_unix_ms: Date.now(),
      exported_at_iso: new Date().toISOString(),
      columns: EXPORT_COLUMNS,
      rows: buildExportRows(),
    };
  }

  function buildCsvContent(snapshot) {
    const rows = snapshot.rows.map((row) => EXPORT_COLUMNS.map((column) => row[column] ?? ""));
    return [EXPORT_COLUMNS, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  function buildJsonContent(snapshot) {
    return `${JSON.stringify(snapshot, null, 2)}\n`;
  }

  function buildExportRows() {
    const rows = [];
    const deadBallByBipId = buildDeadBallLookup(state.tasks);

    state.tasks.forEach((task) => {
      rows.push({
        activity_id: state.activityId,
        activity_name: state.activityName,
        entity_type: "task",
        task_id: task.id,
        task_name: task.name,
        bip_id: "",
        bip_name: "",
        ruck_id: "",
        ruck_count: String(task.rucks.length),
        start_time_unix_ms: task.startUnixMs,
        end_time_unix_ms: task.endUnixMs,
        start_time_seconds: formatSeconds(task.startMs),
        end_time_seconds: formatSeconds(task.endMs),
        ruck_time_unix_ms: "",
        ruck_start_time_unix_ms: "",
        ruck_end_time_unix_ms: "",
        ruck_time_seconds: "",
        ruck_start_time_seconds: "",
        ruck_end_time_seconds: "",
        duration_seconds: formatSeconds(taskDurationMs(task)),
        pre_dead_ball_seconds: "",
        post_dead_ball_seconds: "",
      });

      task.bips.forEach((bip) => {
        rows.push({
          activity_id: state.activityId,
          activity_name: state.activityName,
          entity_type: "bip",
          task_id: task.id,
          task_name: task.name,
          bip_id: bip.id,
          bip_name: bip.label,
          ruck_id: "",
          ruck_count: String(task.rucks.filter((ruck) => ruck.bipId === bip.id).length),
          start_time_unix_ms: bip.startUnixMs === "" ? Math.round(state.originUnixMs + bip.startMs) : bip.startUnixMs,
          end_time_unix_ms: bip.endUnixMs === "" ? Math.round(state.originUnixMs + bip.endMs) : bip.endUnixMs,
          start_time_seconds: formatSeconds(bip.startMs),
          end_time_seconds: formatSeconds(bip.endMs),
          ruck_time_unix_ms: "",
          ruck_start_time_unix_ms: "",
          ruck_end_time_unix_ms: "",
          ruck_time_seconds: "",
          ruck_start_time_seconds: "",
          ruck_end_time_seconds: "",
          duration_seconds: formatSeconds(bip.endMs - bip.startMs),
          pre_dead_ball_seconds: deadBallByBipId.get(bip.id)?.pre_dead_ball_seconds || "",
          post_dead_ball_seconds: deadBallByBipId.get(bip.id)?.post_dead_ball_seconds || "",
        });
      });

      task.rucks.forEach((ruck) => {
        const ruckTimeUnixMs = ruck.timeUnixMs !== "" ? ruck.timeUnixMs : state.originUnixMs + ruck.timeMs;
        rows.push({
          activity_id: state.activityId,
          activity_name: state.activityName,
          entity_type: "ruck",
          task_id: task.id,
          task_name: task.name,
          bip_id: ruck.bipId || "",
          bip_name: ruck.bipId ? getBipName(task, ruck.bipId) : "",
          ruck_id: ruck.id,
          ruck_count: "",
          start_time_unix_ms: ruckTimeUnixMs,
          end_time_unix_ms: ruckTimeUnixMs,
          start_time_seconds: formatSeconds(ruck.timeMs),
          end_time_seconds: formatSeconds(ruck.timeMs),
          ruck_time_unix_ms: ruckTimeUnixMs,
          ruck_start_time_unix_ms: Math.max(0, ruckTimeUnixMs - Math.min(RUCK_WINDOW_MS, ruck.timeMs)),
          ruck_end_time_unix_ms: ruckTimeUnixMs + RUCK_WINDOW_MS,
          ruck_time_seconds: formatSeconds(ruck.timeMs),
          ruck_start_time_seconds: formatSeconds(Math.max(0, ruck.timeMs - RUCK_WINDOW_MS)),
          ruck_end_time_seconds: formatSeconds(ruck.timeMs + RUCK_WINDOW_MS),
          duration_seconds: formatSeconds(0),
          pre_dead_ball_seconds: "",
          post_dead_ball_seconds: "",
        });
      });
    });

    return rows;
  }

  function buildDeadBallLookup(tasks) {
    const lookup = new Map();

    tasks.forEach((task) => {
      const orderedBips = [...task.bips].sort((left, right) => left.startMs - right.startMs);
      orderedBips.forEach((bip, index) => {
        const previousEndMs = index === 0 ? task.startMs : orderedBips[index - 1].endMs;
        const nextStartMs = index === orderedBips.length - 1 ? task.endMs : orderedBips[index + 1].startMs;
        lookup.set(bip.id, {
          pre_dead_ball_seconds: formatSeconds(Math.max(0, bip.startMs - previousEndMs)),
          post_dead_ball_seconds: formatSeconds(Math.max(0, nextStartMs - bip.endMs)),
        });
      });
    });

    return lookup;
  }

  function syncExportButtons() {
    const disabled = !state.tasks.length;
    el.editorExportCsvBtn.disabled = disabled;
    el.editorExportJsonBtn.disabled = disabled;
    el.editorExportZipBtn.disabled = disabled;
    el.alignStartAllBtn.disabled = disabled;
    el.alignEndAllBtn.disabled = disabled;
    el.alignBothAllBtn.disabled = disabled;
  }

  function selectedTask() {
    return state.tasks.find((task) => task.id === state.selectedTaskId) || null;
  }

  function totalBips() {
    return state.tasks.reduce((sum, task) => sum + task.bips.length, 0);
  }

  function totalRucks() {
    return state.tasks.reduce((sum, task) => sum + task.rucks.length, 0);
  }

  function totalWindowMs() {
    if (!state.tasks.length) {
      return 0;
    }
    const startMs = Math.min(...state.tasks.map((task) => task.startMs));
    const endMs = Math.max(...state.tasks.map((task) => task.endMs));
    return Math.max(0, endMs - startMs);
  }

  function taskDurationMs(task) {
    return Math.max(0, task.endMs - task.startMs);
  }

  function sortTasks() {
    state.tasks.sort((left, right) => {
      if (left.startMs !== right.startMs) {
        return left.startMs - right.startMs;
      }
      return left.name.localeCompare(right.name);
    });
  }

  function clampTaskStart(task, nextMs) {
    const maxStartMs = task.bips.length ? task.bips[0].startMs : task.endMs;
    return clamp(nextMs, 0, maxStartMs);
  }

  function clampTaskEnd(task, nextMs) {
    const minEndMs = task.bips.length ? task.bips[task.bips.length - 1].endMs : task.startMs;
    return Math.max(minEndMs, nextMs);
  }

  function syncTaskUnixBounds(task, originUnixMs) {
    task.startUnixMs = Math.round(originUnixMs + task.startMs);
    task.endUnixMs = Math.round(originUnixMs + task.endMs);
  }

  function taskIndex(taskId) {
    return state.tasks.findIndex((task) => task.id === taskId);
  }

  function renderScaleItem(totalMs, ratio) {
    return `
      <div class="timeline-scale__item">
        <span class="timeline-scale__label">${esc(formatCompactDuration(totalMs * ratio))}</span>
      </div>
    `;
  }

  function buildScale(totalMs) {
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => renderScaleItem(totalMs, ratio)).join("");
  }

  function intervalStyle(startMs, endMs, totalMs) {
    const left = toPercent(startMs, totalMs);
    const width = Math.max(toPercent(endMs - startMs, totalMs), 1.4);
    return `left:${left}%;width:${width}%;`;
  }

  function toPercent(value, total) {
    if (!Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return (Math.max(0, value) / total) * 100;
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
      const nameBytes = textEncoder.encode(entry.name);
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

  function byteLength(parts) {
    return parts.reduce((sum, part) => sum + part.length, 0);
  }

  function createEditorState() {
    return {
      activityId: "",
      activityName: DEFAULT_ACTIVITY,
      sourceName: "",
      sourceType: "",
      importedAtIso: "",
      exportedAtIso: "",
      rowCount: 0,
      tasks: [],
      selectedTaskId: null,
      originUnixMs: 0,
      dirty: false,
    };
  }

  function normalizeRowShape(row) {
    const result = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      result[String(key || "").trim()] = value;
    });
    return result;
  }

  function firstNonEmpty(...values) {
    return values.find((value) => toText(value)) || "";
  }

  function toText(value) {
    return String(value ?? "").trim();
  }

  function unixValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : "";
  }

  function secondsValue(value) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 1000)) : 0;
  }

  function optionalSecondsValue(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return null;
    }
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 1000)) : null;
  }

  function numberInputToMs(value) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 1000)) : null;
  }

  function taskName(value, fallbackIndex) {
    const text = toText(value);
    return text || `Task ${fallbackIndex}`;
  }

  function bipLabel(value, fallbackIndex) {
    const text = toText(value);
    return text || `BIP ${fallbackIndex}`;
  }

  function getBipName(task, bipId) {
    return task.bips.find((bip) => bip.id === bipId)?.label || "";
  }

  function formatSeconds(valueMs) {
    return (Math.max(0, Number(valueMs || 0)) / 1000).toFixed(2);
  }

  function formatCompactDuration(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(Number(totalMs || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
      : `${pad2(minutes)}:${pad2(seconds)}`;
  }

  function formatReviewDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown import";
    }
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
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

  function syncInputValue(input, value) {
    if (input.value !== value) {
      input.value = value;
    }
  }

  function announce(message) {
    el.editorSrStatus.textContent = message;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function pad2(value) {
    return String(Math.max(0, Math.trunc(value))).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function esc(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createId() {
    return window.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  }
})();
