(() => {
  const STORAGE_KEY = "ball-in-play-logger-session-v1";
  const REVIEW_SOURCE_KEY = "ball-in-play-logger-review-source-v1";
  const DEFAULT_PERIOD = "";
  const DEFAULT_ACTIVITY = "Activity";
  const EXPORT_PERIOD = "Untitled Period";
  const RUCK_WINDOW_MS = 1500;
  const MAX_ACTIVITY = 64;
  const MAX_PERIOD = 48;
  const MAX_TASK = 64;

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

  const DURATION_BUCKETS = [
    { label: "0-30", min: 0, max: 30 },
    { label: "31-60", min: 30.000001, max: 60 },
    { label: "61-90", min: 60.000001, max: 90 },
    { label: "91-120", min: 90.000001, max: 120 },
    { label: "121-180", min: 120.000001, max: 180 },
    { label: "180+", min: 180.000001, max: Number.POSITIVE_INFINITY },
  ];

  const PHASE_BUCKETS = [
    { label: "0-3", min: 0, max: 3 },
    { label: "4-6", min: 4, max: 6 },
    { label: "7-9", min: 7, max: 9 },
    { label: "10-12", min: 10, max: 12 },
    { label: "13-15", min: 13, max: 15 },
    { label: "16-20", min: 16, max: 20 },
    { label: "21+", min: 21, max: Number.POSITIVE_INFINITY },
  ];

  const el = {
    reviewTopActivity: document.getElementById("reviewTopActivity"),
    reviewTopStatus: document.getElementById("reviewTopStatus"),
    reviewTitle: document.getElementById("reviewTitle"),
    reviewDate: document.getElementById("reviewDate"),
    reviewWindow: document.getElementById("reviewWindow"),
    reviewExportCsvBtn: document.getElementById("reviewExportCsvBtn"),
    reviewExportJsonBtn: document.getElementById("reviewExportJsonBtn"),
    reviewExportZipBtn: document.getElementById("reviewExportZipBtn"),
    kpiWork: document.getElementById("kpiWork"),
    kpiRest: document.getElementById("kpiRest"),
    kpiRatio: document.getElementById("kpiRatio"),
    ratioGauge: document.getElementById("ratioGauge"),
    kpiPhases: document.getElementById("kpiPhases"),
    kpiClock: document.getElementById("kpiClock"),
    durationBuckets: document.getElementById("durationBuckets"),
    phaseBuckets: document.getElementById("phaseBuckets"),
    reviewTaskSummary: document.getElementById("reviewTaskSummary"),
    reviewEmpty: document.getElementById("reviewEmpty"),
    reviewTableWrap: document.getElementById("reviewTableWrap"),
    taskTableBody: document.getElementById("taskTableBody"),
    reviewSrStatus: document.getElementById("reviewSrStatus"),
  };

  let session = loadSession();
  let tickTimer = null;
  const zipEncoder = new TextEncoder();
  const crcTable = buildCrcTable();

  bindEvents();
  renderAll();
  syncClockTimer();

  function bindEvents() {
    el.reviewExportCsvBtn.addEventListener("click", exportCsv);
    el.reviewExportJsonBtn.addEventListener("click", exportJson);
    el.reviewExportZipBtn.addEventListener("click", exportBundleZip);

    window.addEventListener("storage", (event) => {
      if (event.key && ![STORAGE_KEY, REVIEW_SOURCE_KEY].includes(event.key)) {
        return;
      }
      refreshSession();
    });

    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshSession();
      }
    });
  }

  function refreshSession() {
    session = loadSession();
    renderAll();
    syncClockTimer();
  }

  function renderAll() {
    const snapshot = getReviewSnapshot();
    renderHeader(snapshot);
    renderKpis(snapshot);
    renderDistributions(snapshot);
    renderTaskTable(snapshot);
  }

  function renderHeader(snapshot) {
    const statusLabel = snapshot.isFinished
      ? "Finished"
      : snapshot.clockState === "running"
        ? "Running"
        : snapshot.hasTasks
          ? "Paused"
          : "Idle";

    document.title = `${snapshot.activityLabel} — BIP Review`;
    el.reviewTopActivity.textContent = snapshot.activityLabel;
    el.reviewTopStatus.textContent = statusLabel;
    el.reviewTopStatus.classList.toggle("state-pill--running", snapshot.clockState === "running" && !snapshot.isFinished);
    el.reviewTopStatus.classList.toggle("state-pill--paused", snapshot.clockState !== "running" && !snapshot.isFinished);
    el.reviewTopStatus.classList.toggle("state-pill--finished", snapshot.isFinished);

    el.reviewTitle.textContent = snapshot.activityLabel;
    el.reviewDate.textContent = snapshot.createdAt
      ? `Started ${formatReviewDate(snapshot.createdAt)}`
      : "Start a session in Logger to see the review.";
    el.reviewWindow.textContent = snapshot.hasTasks
      ? `${snapshot.tasks.length} drills · ${snapshot.totalBips} BIPs · active window ${formatCompactDuration(snapshot.activeWindowMs)}`
      : "Awaiting drill data";
  }

  function renderKpis(snapshot) {
    el.kpiWork.textContent = formatCompactDuration(snapshot.workMs);
    el.kpiRest.textContent = formatCompactDuration(snapshot.restMs);
    el.kpiRatio.textContent = `${Math.round(snapshot.workRatio * 100)}%`;
    el.ratioGauge.style.setProperty("--ratio", `${Math.round(snapshot.workRatio * 360)}deg`);
    el.kpiPhases.textContent = String(snapshot.totalRucks);
    el.kpiClock.textContent = formatClock(snapshot.elapsedMs);
  }

  function renderDistributions(snapshot) {
    el.durationBuckets.innerHTML = renderBucketList(snapshot.durationBuckets);
    el.phaseBuckets.innerHTML = renderBucketList(snapshot.phaseBuckets);
  }

  function renderBucketList(buckets) {
    return `
      <div class="bucket-strip" style="--bucket-count:${buckets.length};">
        ${buckets
          .map(
            (bucket) => `
              <div class="bucket-chip">
                <span class="bucket-chip__label">${esc(bucket.label)}</span>
                <strong class="bucket-chip__value">${bucket.count}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderTaskTable(snapshot) {
    el.reviewTaskSummary.textContent = snapshot.hasTasks
      ? `${snapshot.tasks.length} drills · ${snapshot.totalBips} BIPs · ${snapshot.totalRucks} phases`
      : "No tasks logged yet.";

    if (!snapshot.hasTasks) {
      el.reviewEmpty.hidden = false;
      el.reviewTableWrap.hidden = true;
      el.taskTableBody.innerHTML = "";
      return;
    }

    el.reviewEmpty.hidden = true;
    el.reviewTableWrap.hidden = false;
    el.taskTableBody.innerHTML = snapshot.tasks
      .map((task) => `
        <tr>
          <td class="review-table__metric review-table__metric--accent">${esc(formatCompactDuration(task.workMs))}</td>
          <td class="review-table__metric review-table__metric--muted">${esc(formatCompactDuration(task.restMs))}</td>
          <td class="review-table__metric">${esc(formatPercent(task.workRatio))}</td>
          <td class="review-table__metric">${task.ruckCount}</td>
          <td>
            <div class="review-table__task">
              <div class="review-table__task-title">
                <span class="review-badge${task.isActive ? " review-badge--live" : ""}">${task.isActive ? "Live" : "Task"}</span>
                <span>${esc(task.name)}</span>
              </div>
              <div class="review-table__task-meta">${task.bipCount} BIPs · ${task.ruckCount} phases · starts ${esc(formatCompactDuration(task.startElapsedMs))}</div>
            </div>
          </td>
          <td class="review-table__metric">${esc(formatCompactDuration(task.durationMs))}</td>
        </tr>
      `)
      .join("");
  }

  function getReviewSnapshot() {
    const elapsedMs = getCurrentElapsedMs();
    const tasks = session.tasks
      .map((task) => toReviewTask(task, elapsedMs))
      .sort((left, right) => left.startElapsedMs - right.startElapsedMs);
    const hasTasks = tasks.length > 0;
    const activeWindowStartMs = hasTasks ? tasks[0].startElapsedMs : 0;
    const activeWindowEndMs = hasTasks ? Math.max(...tasks.map((task) => task.effectiveEndElapsedMs)) : 0;
    const activeWindowMs = hasTasks ? Math.max(0, activeWindowEndMs - activeWindowStartMs) : 0;
    const workMs = tasks.reduce((sum, task) => sum + task.workMs, 0);
    const restMs = Math.max(0, activeWindowMs - workMs);
    const totalRucks = tasks.reduce((sum, task) => sum + task.ruckCount, 0);
    const totalBips = tasks.reduce((sum, task) => sum + task.bipCount, 0);

    return {
      createdAt: session.createdAt,
      elapsedMs,
      clockState: session.clockState,
      isFinished: session.isFinished === true,
      activityLabel: exportActivityLabel(session.activityName),
      hasTasks,
      tasks,
      workMs,
      restMs,
      workRatio: activeWindowMs > 0 ? workMs / activeWindowMs : 0,
      totalRucks,
      totalBips,
      activeWindowMs,
      durationBuckets: buildBucketCounts(
        tasks.flatMap((task) => task.bips.map((bip) => bip.durationMs / 1000)),
        DURATION_BUCKETS
      ),
      phaseBuckets: buildBucketCounts(
        tasks.map((task) => task.ruckCount),
        PHASE_BUCKETS
      ),
    };
  }

  function toReviewTask(task, currentElapsedMs) {
    const effectiveEndElapsedMs = taskEndMs(task, currentElapsedMs);
    const bips = task.bips.map((bip) => {
      const effectiveBipEndElapsedMs = bipEndMs(bip, currentElapsedMs);
      return {
        ...bip,
        effectiveEndElapsedMs: effectiveBipEndElapsedMs,
        durationMs: Math.max(0, effectiveBipEndElapsedMs - bip.startElapsedMs),
      };
    });
    const workMs = bips.reduce((sum, bip) => sum + bip.durationMs, 0);
    const durationMs = Math.max(0, effectiveEndElapsedMs - task.startElapsedMs);
    const restMs = Math.max(0, durationMs - workMs);

    return {
      ...task,
      effectiveEndElapsedMs,
      durationMs,
      bips,
      workMs,
      restMs,
      workRatio: durationMs > 0 ? workMs / durationMs : 0,
      bipCount: bips.length,
      ruckCount: task.rucks.length,
      isActive: task.endElapsedMs == null && session.activeTaskId === task.id,
    };
  }

  function buildBucketCounts(values, definitions) {
    return definitions.map((definition) => ({
      label: definition.label,
      count: values.filter((value) => value >= definition.min && value <= definition.max).length,
    }));
  }

  function exportCsv() {
    refreshSession();
    const snapshot = getExportSnapshot();
    triggerDownload(
      `${buildFilenameBase(snapshot.activityName, snapshot.exportedAt)}.csv`,
      buildCsvContent(snapshot),
      "text/csv;charset=utf-8"
    );
    announce("CSV exported from review.");
  }

  function exportJson() {
    refreshSession();
    const snapshot = getExportSnapshot();
    triggerDownload(
      `${buildFilenameBase(snapshot.activityName, snapshot.exportedAt)}.json`,
      buildJsonContent(snapshot),
      "application/json;charset=utf-8"
    );
    announce("JSON exported from review.");
  }

  function exportBundleZip() {
    refreshSession();
    const snapshot = getExportSnapshot();
    const base = buildFilenameBase(snapshot.activityName, snapshot.exportedAt);
    const zipBlob = buildZipBlob(base, [
      { name: `${base}.csv`, bytes: zipEncoder.encode(buildCsvContent(snapshot)) },
      { name: `${base}.json`, bytes: zipEncoder.encode(buildJsonContent(snapshot)) },
    ]);
    triggerBlobDownload(`${base}.zip`, zipBlob);
    announce("ZIP exported from review.");
  }

  function getExportSnapshot() {
    const nowIso = new Date().toISOString();
    const elapsedMs = getCurrentElapsedMs();
    return {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      exportedAt: nowIso,
      activityName: exportActivityLabel(session.activityName),
      clockState: session.clockState,
      elapsedMs,
      lastStartedAt: session.lastStartedAt,
      activeTaskId: session.activeTaskId,
      activeBipId: session.activeBipId,
      tasks: session.tasks.map((task) => exportTask(task, elapsedMs)),
      events: session.events.map((eventItem) => ({ ...eventItem })),
    };
  }

  function buildCsvContent(snapshot) {
    const rows = buildExportRows(snapshot).map((row) => EXPORT_COLUMNS.map((column) => row[column] ?? ""));
    return [EXPORT_COLUMNS, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  function buildJsonContent(snapshot) {
    return `${JSON.stringify(
      {
        activity_id: snapshot.sessionId,
        activity_name: snapshot.activityName,
        exported_at_unix_ms: toUnixMs(snapshot.exportedAt),
        exported_at_iso: snapshot.exportedAt,
        columns: EXPORT_COLUMNS,
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
        ruck_count: String(task.rucks.length),
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
          ruck_count: String(countBipRucks(task, bip.id)),
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
          ruck_count: "",
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

  function exportTask(task, currentElapsedMs) {
    const effectiveEndElapsedMs = taskEndMs(task, currentElapsedMs);
    return {
      ...task,
      effectiveEndElapsedMs,
      durationMs: Math.max(0, effectiveEndElapsedMs - task.startElapsedMs),
      bips: task.bips.map((bip) => {
        const effectiveBipEndElapsedMs = bipEndMs(bip, currentElapsedMs);
        return {
          ...bip,
          effectiveEndElapsedMs: effectiveBipEndElapsedMs,
          durationMs: Math.max(0, effectiveBipEndElapsedMs - bip.startElapsedMs),
        };
      }),
      rucks: task.rucks.map((ruck) => ({ ...ruck })),
    };
  }

  function countBipRucks(task, bipId) {
    return task.rucks.filter((ruck) => ruck.bipId === bipId).length;
  }

  function getCurrentElapsedMs(now = new Date()) {
    const baseElapsedMs = normMs(session.elapsedMs);
    if (session.clockState !== "running" || !session.lastStartedAt) {
      return baseElapsedMs;
    }

    const startedAtMs = Date.parse(session.lastStartedAt);
    if (!Number.isFinite(startedAtMs)) {
      return baseElapsedMs;
    }

    return baseElapsedMs + Math.max(0, now.getTime() - startedAtMs);
  }

  function taskEndMs(task, currentElapsedMs) {
    return task.endElapsedMs == null ? currentElapsedMs : task.endElapsedMs;
  }

  function bipEndMs(bip, currentElapsedMs) {
    return bip.endElapsedMs == null ? currentElapsedMs : bip.endElapsedMs;
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

  function loadSession() {
    try {
      const reviewSource = loadEditorReviewSource();
      if (reviewSource) {
        return reviewSource;
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeSession(JSON.parse(raw)) : createSession();
    } catch (error) {
      console.error("Unable to load session", error);
      return createSession();
    }
  }

  function loadEditorReviewSource() {
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
      console.error("Unable to load review source", error);
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

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
      index: 0,
      type: typeof raw.type === "string" ? raw.type : "",
      label: typeof raw.label === "string" ? raw.label : "",
      period: exportPeriodLabel(raw.period),
      elapsedMs: normMs(raw.elapsedMs),
      createdAt: isValidDate(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      taskId: typeof raw.taskId === "string" ? raw.taskId : null,
      taskName: typeof raw.taskName === "string" ? raw.taskName : "",
      bipId: typeof raw.bipId === "string" ? raw.bipId : null,
      bipName: typeof raw.bipName === "string" ? raw.bipName : "",
    };
  }

  function findTask(tasks, taskId) {
    return taskId ? tasks.find((task) => task.id === taskId) || null : null;
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

  function taskLabel(value, fallbackIndex) {
    const text = String(value || "").trim();
    return text || `Task ${fallbackIndex}`;
  }

  function bipLabel(value, fallbackIndex) {
    const text = String(value || "").trim();
    return text || `BIP ${fallbackIndex}`;
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

  function formatClock(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(Number(totalMs || 0) / 1000));
    return `${pad2(Math.floor(totalSeconds / 3600))}:${pad2(Math.floor((totalSeconds % 3600) / 60))}:${pad2(totalSeconds % 60)}`;
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

  function formatPercent(value) {
    return `${Math.round(Math.max(0, value) * 100)}%`;
  }

  function formatReviewDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
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

  function announce(message) {
    el.reviewSrStatus.textContent = message;
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

  function syncClockTimer() {
    const shouldRun = session.clockState === "running";
    if (shouldRun && !tickTimer) {
      tickTimer = window.setInterval(() => {
        renderAll();
      }, 1000);
      return;
    }

    if (!shouldRun && tickTimer) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  }
})();
