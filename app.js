
const STORAGE_KEY = "vistaboard_state_v2";
const LEGACY_STORAGE_KEY = "vistaboard_state_v1";

const MODULES = [
  { key: "estimate", title: "Смета", desc: "Бюджет и ставки" },
  { key: "script", title: "Сценарий", desc: "Сцены и тексты" },
  { key: "admin", title: "Админ. панель", desc: "Команда и роли" },
  { key: "frames", title: "Кадры", desc: "Shot list и версии" },
  { key: "sound", title: "Звук", desc: "Аудио задачи" },
  { key: "edit", title: "Монтаж", desc: "Постпродакшен" },
];

const ROLE_OPTIONS = ["Producer", "Ai-artist", "Director", "Editor", "Sound", "Client", "Admin"];
const SCRIPT_STATUS_OPTIONS = ["Draft", "Review", "Approved", "Blocked"];
const TASK_STATUS_OPTIONS = ["todo", "doing", "done"];
const FRAME_COLOR_OPTIONS = [
  { key: "green", label: "Зеленый", hex: "#16a34a" },
  { key: "blue", label: "Синий", hex: "#2563eb" },
  { key: "violet", label: "Фиолетовый", hex: "#7c3aed" },
  { key: "pink", label: "Розовый", hex: "#db2777" },
  { key: "yellow", label: "Желтый", hex: "#f59e0b" },
  { key: "red", label: "Красный", hex: "#dc2626" },
];
const SUPABASE_STORAGE_DEFAULT_BUCKET = "videos";
const SYNC_CONFIG_KEY = "vistaboard_sync_config_v1";
const SYNC_POLL_MS = 12000;

let state = loadState();
let currentRoute = null;
const ui = { search: "", selectedFrameByScene: {}, pendingVideoTarget: null, localVideoUrlsByFrameId: {}, videoModalFrameId: "" };
const syncRuntime = { cfg: null, pushTimer: null, pollTimer: null, lastRemoteUpdatedAt: "", lastSyncAt: "", isPushing: false, isPulling: false, status: "off", lastError: "" };

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function sceneKey(projectId, sceneId) {
  return `${projectId}:${sceneId}`;
}

function seedState() {
  return {
    selectedProjectId: "p-1",
    folders: [
      { id: "folder-main", name: "Основные проекты" },
    ],
    projects: [
      { id: "p-1", name: "Проект 1", tag: "Ai", client: "Kutuzov Studio", status: "In progress", updatedAt: nowISO(), folderId: "folder-main", preview: [{ src: "assets/project-1.svg", x: 20, y: 20, w: 30, h: 25 }, { src: "assets/project-2.svg", x: 52, y: 20, w: 30, h: 25 }, { src: "assets/project-3.svg", x: 20, y: 47, w: 46, h: 36 }] },
      { id: "p-2", name: "Проект 2", tag: "Gr", client: "Nord View", status: "Review", updatedAt: nowISO(), folderId: "folder-main", preview: [{ src: "assets/project-2.svg", x: 8, y: 16, w: 84, h: 64 }] },
      { id: "p-3", name: "Проект 3", tag: "Ci", client: "LogHub", status: "Draft", updatedAt: nowISO(), folderId: "folder-main", preview: [{ src: "assets/project-3.svg", x: 24, y: 20, w: 52, h: 50 }] },
    ],
    budgetByProjectId: {
      "p-1": [
        { id: "b1", title: "Script / Сценарий", specialist: "Producer", cost: 20000, markup: 0 },
        { id: "b2", title: "AI artists", specialist: "AI team", cost: 80000, markup: 15 },
        { id: "b3", title: "Монтаж", specialist: "Editor", cost: 55000, markup: 12 },
      ],
    },
    scriptsByProjectId: {
      "p-1": [
        { id: "s1", title: "Сцена 1. Встреча", duration: "0-20 сек", status: "Approved", text: "Кутузов и Александр в зале." },
        { id: "s2", title: "Сцена 2. Мозговой штурм", duration: "20-60 сек", status: "Review", text: "Стикеры и стратегия." },
      ],
    },
    teamByProjectId: {
      "p-1": [
        { id: "t1", name: "Sam", role: "Ai-artist", hoursLeft: 144, rights: "edit" },
        { id: "t2", name: "Andrew D.", role: "Ai-artist", hoursLeft: 144, rights: "edit" },
        { id: "t3", name: "Irina", role: "Admin", hoursLeft: 9999, rights: "admin" },
        { id: "t4", name: "Dima", role: "Editor", hoursLeft: 288, rights: "edit" },
      ],
    },
    scenesByProjectId: {
      "p-1": [
        { id: "scene-01", name: "Scene_01", owner: "Sam", progress: 30 },
        { id: "scene-02", name: "Scene_02", owner: "Sam", progress: 60 },
        { id: "scene-03", name: "Scene_03", owner: "Andrew", progress: 45 },
      ],
    },
    framesBySceneId: {
      "p-1:scene-01": [
        { id: "f-0050", code: "0050", sceneId: "scene-01", parentId: null, text: "Мужчины у входа в дворец.", image: "", markColor: "blue" },
        { id: "f-0050-v1", code: "0050_V1", sceneId: "scene-01", parentId: "f-0050", text: "Версия V1.", image: "assets/frame-0050-v1.svg", markColor: "" },
        { id: "f-0050-v2", code: "0050_V2", sceneId: "scene-01", parentId: "f-0050", text: "Версия V2.", image: "assets/frame-0050-v2.svg", markColor: "yellow" },
        { id: "f-0060", code: "0060", sceneId: "scene-01", parentId: null, text: "Поясной план, 5 сек.", image: "", markColor: "" },
      ],
    },
    commentsByFrameId: { "f-0050-v1": ["Свет хороший, но можно усилить контраст."] },
    frameNotesById: { "f-0050-v1": "Основная версия на согласование." },
    tasksByModuleByProjectId: {
      "p-1": {
        sound: [{ id: "snd1", title: "Подобрать ambient", owner: "Pedro", status: "doing", due: "2026-03-09" }],
        edit: [{ id: "ed1", title: "Черновой монтаж v1", owner: "Dima", status: "doing", due: "2026-03-10" }],
      },
    },
    activityByProjectId: { "p-1": [{ id: uid("act"), ts: nowISO(), text: "Проект инициализирован", type: "info" }] },
  };
}

function ensureProjectStore(target, projectId) {
  if (!target.budgetByProjectId[projectId]) target.budgetByProjectId[projectId] = [];
  if (!target.scriptsByProjectId[projectId]) target.scriptsByProjectId[projectId] = [];
  if (!target.teamByProjectId[projectId]) target.teamByProjectId[projectId] = [];
  if (!target.scenesByProjectId[projectId]) target.scenesByProjectId[projectId] = [];
  if (!target.tasksByModuleByProjectId[projectId]) target.tasksByModuleByProjectId[projectId] = { sound: [], edit: [] };
  if (!target.activityByProjectId[projectId]) target.activityByProjectId[projectId] = [];
  for (const scene of target.scenesByProjectId[projectId]) {
    const key = sceneKey(projectId, scene.id);
    if (!target.framesBySceneId[key]) target.framesBySceneId[key] = [];
  }
}

function normalizeState(parsed) {
  const base = seedState();
  const parsedFolders = Array.isArray(parsed.folders) ? parsed.folders : base.folders;
  const folders = parsedFolders.filter((folder) => folder && folder.id !== "folder-archive" && String(folder.name || "").trim().toLowerCase() !== "архив");
  const safeFolders = folders.length ? folders : base.folders;
  const out = {
    ...base,
    ...parsed,
    folders: safeFolders,
    projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : base.projects,
    budgetByProjectId: { ...base.budgetByProjectId, ...(parsed.budgetByProjectId || {}) },
    scriptsByProjectId: { ...base.scriptsByProjectId, ...(parsed.scriptsByProjectId || {}) },
    teamByProjectId: { ...base.teamByProjectId, ...(parsed.teamByProjectId || {}) },
    scenesByProjectId: { ...base.scenesByProjectId, ...(parsed.scenesByProjectId || {}) },
    framesBySceneId: { ...base.framesBySceneId, ...(parsed.framesBySceneId || {}) },
    commentsByFrameId: { ...base.commentsByFrameId, ...(parsed.commentsByFrameId || {}) },
    frameNotesById: { ...base.frameNotesById, ...(parsed.frameNotesById || {}) },
    tasksByModuleByProjectId: { ...base.tasksByModuleByProjectId, ...(parsed.tasksByModuleByProjectId || {}) },
    activityByProjectId: { ...base.activityByProjectId, ...(parsed.activityByProjectId || {}) },
  };

  const fallbackFolderId = out.folders[0]?.id || "";
  out.projects = out.projects.map((project) => {
    const hasFolder = out.folders.some((folder) => folder.id === project.folderId);
    return {
      ...project,
      folderId: hasFolder ? project.folderId : fallbackFolderId,
    };
  });

  for (const project of out.projects) ensureProjectStore(out, project.id);
  if (!out.projects.find((x) => x.id === out.selectedProjectId)) out.selectedProjectId = out.projects[0]?.id || "";
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return normalizeState(JSON.parse(legacy));
  } catch (_e) {}
  const fresh = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveState(options = {}) {
  const skipRemote = Boolean(options.skipRemote);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!skipRemote) scheduleRemotePush();
}

function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      supabaseUrl: normalizeSupabaseUrl(String(parsed.supabaseUrl || "").trim()),
      anonKey: normalizeSupabaseApiKey(String(parsed.anonKey || "")),
      workspaceId: String(parsed.workspaceId || "default").trim() || "default",
      deviceName: String(parsed.deviceName || "web-client").trim() || "web-client",
      storageBucket: String(parsed.storageBucket || SUPABASE_STORAGE_DEFAULT_BUCKET).trim() || SUPABASE_STORAGE_DEFAULT_BUCKET,
    };
  } catch (_e) {
    return null;
  }
}

function saveSyncConfig(cfg) {
  if (!cfg) {
    localStorage.removeItem(SYNC_CONFIG_KEY);
    syncRuntime.cfg = null;
    return;
  }
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
  syncRuntime.cfg = cfg;
}

function isSyncConfigured() {
  const cfg = syncRuntime.cfg;
  return Boolean(cfg?.supabaseUrl && cfg?.anonKey && cfg?.workspaceId);
}

function syncHeaders(cfg, includeContentType = false, includePrefer = false) {
  const key = normalizeSupabaseApiKey(cfg?.anonKey || "");
  const headers = {
    apikey: key,
  };
  if (looksLikeJwt(key)) headers.Authorization = `Bearer ${key}`;
  if (includeContentType) headers["Content-Type"] = "application/json";
  if (includePrefer) headers.Prefer = "resolution=merge-duplicates,return=representation";
  return headers;
}

async function fetchRemoteWorkspaceState() {
  const cfg = syncRuntime.cfg;
  if (!isSyncConfigured()) throw new Error("Sync не настроен.");
  const base = cfg.supabaseUrl.replace(/\/+$/, "");
  const url = `${base}/rest/v1/workspace_states?select=workspace_id,state_json,updated_at,updated_by&workspace_id=eq.${encodeURIComponent(cfg.workspaceId)}&limit=1`;
  const resp = await fetch(url, { headers: syncHeaders(cfg) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `Sync pull error: ${resp.status}`);
  }
  const rows = await resp.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function pushRemoteState(reason = "auto") {
  if (!isSyncConfigured() || syncRuntime.isPushing || syncRuntime.isPulling) return;
  const cfg = syncRuntime.cfg;
  syncRuntime.isPushing = true;
  syncRuntime.status = "syncing";
  try {
    const base = cfg.supabaseUrl.replace(/\/+$/, "");
    const url = `${base}/rest/v1/workspace_states?on_conflict=workspace_id`;
    const payload = [{
      workspace_id: cfg.workspaceId,
      state_json: state,
      updated_by: cfg.deviceName,
      updated_at: nowISO(),
      reason,
    }];
    const resp = await fetch(url, {
      method: "POST",
      headers: syncHeaders(cfg, true, true),
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(text || `Sync push error: ${resp.status}`);
    }
    const rows = await resp.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]?.updated_at) syncRuntime.lastRemoteUpdatedAt = rows[0].updated_at;
    syncRuntime.lastSyncAt = nowISO();
    syncRuntime.status = "online";
    syncRuntime.lastError = "";
  } catch (error) {
    syncRuntime.status = "error";
    syncRuntime.lastError = error instanceof Error ? error.message : "Sync push error";
  } finally {
    syncRuntime.isPushing = false;
  }
}

async function pullRemoteState(options = {}) {
  if (!isSyncConfigured() || syncRuntime.isPushing || syncRuntime.isPulling) return { found: false, applied: false };
  syncRuntime.isPulling = true;
  syncRuntime.status = "syncing";
  try {
    const row = await fetchRemoteWorkspaceState();
    if (!row) {
      syncRuntime.status = "online";
      syncRuntime.lastError = "";
      return { found: false, applied: false };
    }
    if (row.updated_at && syncRuntime.lastRemoteUpdatedAt && row.updated_at === syncRuntime.lastRemoteUpdatedAt) {
      syncRuntime.status = "online";
      syncRuntime.lastError = "";
      return { found: true, applied: false };
    }

    state = normalizeState(row.state_json || {});
    saveState({ skipRemote: true });
    syncRuntime.lastRemoteUpdatedAt = row.updated_at || nowISO();
    syncRuntime.lastSyncAt = nowISO();
    syncRuntime.status = "online";
    syncRuntime.lastError = "";
    if (options.apply !== false) renderCurrentRoute();
    return { found: true, applied: true };
  } catch (error) {
    syncRuntime.status = "error";
    syncRuntime.lastError = error instanceof Error ? error.message : "Sync pull error";
    return { found: false, applied: false };
  } finally {
    syncRuntime.isPulling = false;
  }
}

function scheduleRemotePush() {
  if (!isSyncConfigured()) return;
  if (syncRuntime.pushTimer) clearTimeout(syncRuntime.pushTimer);
  syncRuntime.pushTimer = setTimeout(() => {
    pushRemoteState("auto");
  }, 700);
}

function startSyncPolling() {
  if (syncRuntime.pollTimer) clearInterval(syncRuntime.pollTimer);
  if (!isSyncConfigured()) return;
  syncRuntime.pollTimer = setInterval(() => {
    pullRemoteState({ apply: true });
  }, SYNC_POLL_MS);
}

function stopSyncPolling() {
  if (syncRuntime.pollTimer) clearInterval(syncRuntime.pollTimer);
  syncRuntime.pollTimer = null;
}

function syncStatusLine() {
  if (!isSyncConfigured()) return "Командный sync: выключен";
  if (syncRuntime.status === "error") return `Командный sync: ошибка (${syncRuntime.lastError || "неизвестно"})`;
  if (syncRuntime.status === "syncing") return "Командный sync: синхронизация...";
  const suffix = syncRuntime.lastSyncAt ? ` • обновлено ${formatRelative(syncRuntime.lastSyncAt)}` : "";
  return `Командный sync: онлайн${suffix}`;
}

async function connectSync() {
  syncRuntime.cfg = loadSyncConfig();
  if (!isSyncConfigured()) {
    syncRuntime.status = "off";
    syncRuntime.lastError = "";
    stopSyncPolling();
    return;
  }
  syncRuntime.status = "syncing";
  const pulled = await pullRemoteState({ apply: true });
  if (!pulled.found) await pushRemoteState("init");
  startSyncPolling();
}

function addActivity(projectId, text, type = "update") {
  ensureProjectStore(state, projectId);
  state.activityByProjectId[projectId].unshift({ id: uid("act"), ts: nowISO(), text, type });
  state.activityByProjectId[projectId] = state.activityByProjectId[projectId].slice(0, 40);
  const project = getProject(projectId);
  if (project) project.updatedAt = nowISO();
  saveState();
}
function getProject(projectId) {
  return state.projects.find((x) => x.id === projectId) || null;
}

function getScenes(projectId) {
  ensureProjectStore(state, projectId);
  return state.scenesByProjectId[projectId];
}

function getFrames(projectId, sceneId) {
  ensureProjectStore(state, projectId);
  const key = sceneKey(projectId, sceneId);
  if (!state.framesBySceneId[key]) state.framesBySceneId[key] = [];
  return state.framesBySceneId[key];
}

function getBudget(projectId) {
  ensureProjectStore(state, projectId);
  return state.budgetByProjectId[projectId];
}

function getScript(projectId) {
  ensureProjectStore(state, projectId);
  return state.scriptsByProjectId[projectId];
}

function getTeam(projectId) {
  ensureProjectStore(state, projectId);
  return state.teamByProjectId[projectId];
}

function getTasks(projectId, moduleKey) {
  ensureProjectStore(state, projectId);
  return state.tasksByModuleByProjectId[projectId][moduleKey];
}

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function currency(v) {
  return `${Math.round(Number(v) || 0).toLocaleString("ru-RU")} ₽`;
}

function routeFromHash(hash) {
  const cleaned = (hash || "").replace(/^#\/?/, "");
  if (!cleaned || cleaned === "home") return { name: "home" };
  const p = cleaned.split("/").filter(Boolean);
  if (p[0] !== "project") return { name: "notFound" };
  const projectId = p[1];
  if (!projectId) return { name: "home" };
  if (p.length === 2) return { name: "project", projectId };
  const section = p[2];
  if (["estimate", "script", "admin", "sound", "edit"].includes(section)) return { name: section, projectId };
  if (section === "frames") {
    if (p.length === 3) return { name: "frames", projectId };
    if (p.length === 4) return { name: "scene", projectId, sceneId: p[3] };
    if (p.length === 5 && p[4] === "board") return { name: "sceneBoard", projectId, sceneId: p[3] };
  }
  return { name: "notFound" };
}

function navigate(hash) {
  if (window.location.hash === hash) {
    renderCurrentRoute();
    return;
  }
  window.location.hash = hash;
}

function avgProgress(projectId) {
  const scenes = getScenes(projectId);
  if (!scenes.length) return 0;
  return Math.round(scenes.reduce((s, x) => s + (Number(x.progress) || 0), 0) / scenes.length);
}

function budgetTotal(projectId) {
  return getBudget(projectId).reduce((sum, row) => {
    const c = Number(row.cost) || 0;
    const m = Number(row.markup) || 0;
    return sum + c + (c * m) / 100;
  }, 0);
}

function renderTop(title = "", opts = {}) {
  return `
    <header class="topbar">
      <div class="brand-wrap">
        <a class="brand" data-nav="#/home">VistaBoard</a>
        <span class="brand-sub">Product Motion Operations</span>
      </div>
      <div class="top-actions">${opts.right || ""}</div>
    </header>
    ${opts.showBack ? `<div class="toolbar"><button class="btn ghost" data-nav="${opts.backTo}">Назад</button>${opts.listTo ? `<button class="btn ghost" data-nav="${opts.listTo}">Список</button>` : ""}<div class="toolbar-title">${escapeHtml(title)}</div></div>` : ""}
  `;
}

function renderHome() {
  const query = ui.search.trim().toLowerCase();
  const projects = state.projects.filter((p) => !query || p.name.toLowerCase().includes(query) || (p.client || "").toLowerCase().includes(query));
  const buckets = state.folders
    .map((f) => {
      const bucketProjects = projects.filter((p) => p.folderId === f.id);
      return { id: f.id, name: f.name, removable: true, projects: bucketProjects };
    })
    .filter((bucket) => bucket.projects.length);

  return `
    <section class="page">
      ${renderTop("", { right: `<button class="btn ghost small" data-action="configure-sync">Командный sync</button><button class="btn ghost small" data-action="sync-now">Синхр. сейчас</button><button class="btn ghost small" data-action="export">Экспорт</button><button class="btn ghost small" data-action="import">Импорт</button>` })}
      <div class="home-controls">
        <label class="search"><span>Поиск</span><input data-search value="${escapeAttr(ui.search)}" placeholder="Проект, клиент" /></label>
        <div class="actions"><button class="btn" data-action="new-project">+ Новый проект</button><button class="btn" data-action="new-folder">+ Новая папка</button></div>
      </div>
      <div class="storage-status ${isVideoStorageConfigured() ? "ok" : "warn"}">${escapeHtml(videoStorageLabel())}</div>
      <div class="sync-status ${syncRuntime.status === "error" ? "warn" : isSyncConfigured() ? "ok" : "off"}">${escapeHtml(syncStatusLine())}</div>
      <div class="folder-sections">${buckets.length
        ? buckets.map((bucket) => `<section class="folder-section"><header class="folder-head"><div class="folder-head-main"><input class="folder-title-input" data-folder-name data-folder-id="${bucket.id}" value="${escapeAttr(bucket.name)}" aria-label="Название папки" /><span>${bucket.projects.length} проектов</span></div>${bucket.removable ? `<button class="icon-btn" data-action="remove-folder" data-folder-id="${bucket.id}" title="Удалить папку">×</button>` : ""}</header><div class="project-grid">${bucket.projects.map(renderProjectCard).join("")}</div></section>`).join("")
        : `<section class="folder-section"><p class="empty">Проектов пока нет. Создайте первый проект.</p></section>`}</div>
    </section>
  `;
}

function renderProjectCard(project) {
  const scenes = (state.scenesByProjectId[project.id] || []).length;
  return `<article class="project-card"><div class="project-preview project-open" data-action="open-project" data-project-id="${project.id}">${(project.preview || []).map((s) => `<div class="preview-shot" style="left:${s.x}%;top:${s.y}%;width:${s.w}%;height:${s.h}%;background-image:url('${s.src}')"></div>`).join("")}<span class="tag">${escapeHtml(project.tag || "--")}</span></div><div class="project-body"><div class="project-title-row"><h3>${escapeHtml(project.name)}</h3><button class="icon-btn project-edit-btn" data-action="rename-project" data-project-id="${project.id}" title="Переименовать проект">✎</button></div><p>${escapeHtml(project.client || "Без клиента")} • ${escapeHtml(project.status || "Draft")}</p><div class="project-meta"><span>${scenes} сцен</span><span>${avgProgress(project.id)}%</span><span>${formatRelative(project.updatedAt)}</span></div></div><div class="project-controls"><button class="btn small" data-action="open-project" data-project-id="${project.id}">Открыть</button><label class="project-folder-label">Папка<select class="input project-folder-select" data-project-folder data-project-id="${project.id}">${state.folders.map((f) => `<option value="${f.id}" ${project.folderId === f.id ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}</select></label><button class="btn small danger" data-action="remove-home-project" data-project-id="${project.id}">Удалить</button></div></article>`;
}

function renderProject(projectId) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const activity = (state.activityByProjectId[projectId] || []).slice(0, 8);

  return `
    <section class="page">
      ${renderTop(project.name, {
        showBack: true,
        backTo: "#/home",
        right: `<button class="btn small danger" data-action="remove-project" data-project-id="${projectId}">Удалить проект</button>`,
      })}
      <div class="kpi-grid"><article class="kpi"><span>Сцены</span><strong>${getScenes(projectId).length}</strong></article><article class="kpi"><span>Прогресс</span><strong>${avgProgress(projectId)}%</strong></article><article class="kpi"><span>Команда</span><strong>${getTeam(projectId).length}</strong></article><article class="kpi"><span>Бюджет</span><strong>${currency(budgetTotal(projectId))}</strong></article></div>
      <div class="module-grid">${MODULES.map((m) => `<article class="module-card" data-nav="#/project/${projectId}/${m.key}">${renderModulePreview(projectId, m.key)}<h3>${m.title}</h3><p>${m.desc}</p></article>`).join("")}</div>
      <section class="activity"><div class="activity-head"><h3>Последние действия</h3><button class="btn ghost small" data-action="clear-activity" data-project-id="${projectId}">Очистить</button></div>${activity.length ? `<ul>${activity.map((a) => `<li><span>${escapeHtml(a.text)}</span><time>${formatRelative(a.ts)}</time></li>`).join("")}</ul>` : `<p class="empty">Пока нет действий</p>`}</section>
    </section>
  `;
}

function renderNotFound() {
  return `<section class="page centered"><div class="not-found"><h2>Маршрут не найден</h2><button class="btn" data-nav="#/home">На главную</button></div></section>`;
}
function renderEstimate(projectId) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const rows = getBudget(projectId);

  return `
    <section class="page">
      ${renderTop(`${project.name} / Смета`, { showBack: true, backTo: `#/project/${projectId}`, right: `<button class="btn" data-action="add-budget-row" data-project-id="${projectId}">+ Строка</button>` })}
      <section class="table-panel"><table class="table"><thead><tr><th>Работа</th><th>Специалист</th><th>Стоимость</th><th>Наценка %</th><th>Итого</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><input class="table-input" data-bind="budget" data-field="title" data-project-id="${projectId}" data-id="${r.id}" value="${escapeAttr(r.title)}" /></td><td><input class="table-input" data-bind="budget" data-field="specialist" data-project-id="${projectId}" data-id="${r.id}" value="${escapeAttr(r.specialist)}" /></td><td><input class="table-input" type="number" data-bind="budget" data-field="cost" data-project-id="${projectId}" data-id="${r.id}" value="${r.cost}" /></td><td><input class="table-input" type="number" data-bind="budget" data-field="markup" data-project-id="${projectId}" data-id="${r.id}" value="${r.markup}" /></td><td>${currency((Number(r.cost) || 0) + ((Number(r.cost) || 0) * (Number(r.markup) || 0)) / 100)}</td><td><button class="icon-btn" data-action="remove-budget-row" data-project-id="${projectId}" data-id="${r.id}">×</button></td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="4">Итого</td><td colspan="2">${currency(budgetTotal(projectId))}</td></tr></tfoot></table></section>
    </section>
  `;
}

function renderScript(projectId) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const blocks = getScript(projectId);

  return `
    <section class="page">
      ${renderTop(`${project.name} / Сценарий`, { showBack: true, backTo: `#/project/${projectId}`, right: `<button class="btn" data-action="add-script" data-project-id="${projectId}">+ Блок</button>` })}
      <section class="script-grid">${blocks.map((b) => `<article class="script-card"><div class="script-head"><input class="input" data-bind="script" data-field="title" data-project-id="${projectId}" data-id="${b.id}" value="${escapeAttr(b.title)}" /><button class="icon-btn" data-action="remove-script" data-project-id="${projectId}" data-id="${b.id}">×</button></div><div class="script-meta"><input class="input" data-bind="script" data-field="duration" data-project-id="${projectId}" data-id="${b.id}" value="${escapeAttr(b.duration)}" /><select class="input" data-bind="script" data-field="status" data-project-id="${projectId}" data-id="${b.id}">${SCRIPT_STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === b.status ? "selected" : ""}>${s}</option>`).join("")}</select></div><textarea class="textarea" data-bind="script" data-field="text" data-project-id="${projectId}" data-id="${b.id}">${escapeHtml(b.text)}</textarea></article>`).join("")}</section>
    </section>
  `;
}

function renderAdmin(projectId) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const team = getTeam(projectId);

  return `
    <section class="page">
      ${renderTop(`${project.name} / Админ. панель`, { showBack: true, backTo: `#/project/${projectId}`, right: `<button class="btn" data-action="add-team" data-project-id="${projectId}">+ Участник</button>` })}
      <section class="table-panel"><table class="table"><thead><tr><th>Участник</th><th>Роль</th><th>Осталось ч.</th><th>Права</th><th></th></tr></thead><tbody>${team.map((m) => `<tr><td><div class="member"><span class="avatar">${escapeHtml(initials(m.name))}</span><input class="table-input" data-bind="team" data-field="name" data-project-id="${projectId}" data-id="${m.id}" value="${escapeAttr(m.name)}" /></div></td><td><select class="table-input" data-bind="team" data-field="role" data-project-id="${projectId}" data-id="${m.id}">${ROLE_OPTIONS.map((r) => `<option value="${r}" ${r === m.role ? "selected" : ""}>${r}</option>`).join("")}</select></td><td><input class="table-input" type="number" data-bind="team" data-field="hoursLeft" data-project-id="${projectId}" data-id="${m.id}" value="${m.hoursLeft}" /></td><td><select class="table-input" data-bind="team" data-field="rights" data-project-id="${projectId}" data-id="${m.id}"><option value="view" ${m.rights === "view" ? "selected" : ""}>view</option><option value="comment" ${m.rights === "comment" ? "selected" : ""}>comment</option><option value="edit" ${m.rights === "edit" ? "selected" : ""}>edit</option><option value="admin" ${m.rights === "admin" ? "selected" : ""}>admin</option></select></td><td><button class="icon-btn" data-action="remove-team" data-project-id="${projectId}" data-id="${m.id}">×</button></td></tr>`).join("")}</tbody></table></section>
    </section>
  `;
}

function renderFrames(projectId) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const scenes = getScenes(projectId);

  return `
    <section class="page">
      ${renderTop(`${project.name} / Кадры`, { showBack: true, backTo: `#/project/${projectId}`, right: `<button class="btn" data-action="add-scene" data-project-id="${projectId}">+ Сцена</button>` })}
      <div class="frames-layout"><section class="scene-list">${scenes.map((s) => { const videos = getFrames(projectId, s.id).length; return `<article class="scene-row"><div class="scene-preview">${renderScenePreview(projectId, s.id)}</div><div class="scene-main"><button class="scene-open" data-action="open-scene" data-project-id="${projectId}" data-scene-id="${s.id}">${escapeHtml(s.name)}</button><span class="scene-count">${videos} видео</span></div><input class="input scene-owner" data-bind="scene" data-field="owner" data-project-id="${projectId}" data-id="${s.id}" value="${escapeAttr(s.owner)}" /><button class="icon-btn" data-action="remove-scene" data-project-id="${projectId}" data-id="${s.id}">×</button></article>`; }).join("")}</section></div>
    </section>
  `;
}

function renderScenePreview(projectId, sceneId) {
  const frames = getFrames(projectId, sceneId).slice(0, 3);
  if (!frames.length) return `<div class="scene-preview-empty">Нет видео</div>`;

  return `
    <div class="scene-preview-grid">
      ${frames.map((frame, idx) => {
        const src = resolveFrameVideoSrc(frame);
        const media = src
          ? `<video src="${escapeAttr(src)}" muted playsinline preload="metadata"></video>`
          : frame.image
            ? `<img src="${escapeAttr(frame.image)}" alt="${escapeAttr(frame.code)}" />`
            : `<div class="scene-preview-fallback">${escapeHtml(frame.code)}</div>`;
        return `<div class="scene-preview-tile s-tile-${idx + 1}">${media}</div>`;
      }).join("")}
    </div>
  `;
}

function renderScene(projectId, sceneId, board = false) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const scene = getScenes(projectId).find((s) => s.id === sceneId);
  if (!scene) return renderNotFound();

  const frames = getFrames(projectId, sceneId);
  const key = sceneKey(projectId, sceneId);
  const selected = ui.selectedFrameByScene[key] || (frames[0] ? frames[0].id : "");
  ui.selectedFrameByScene[key] = selected;
  const selectedFrame = frames.find((f) => f.id === selected) || frames[0] || null;

  return `
    <section class="page">
      ${renderTop(`${project.name} / ${scene.name}`, {
        showBack: true,
        backTo: `#/project/${projectId}/frames`,
        listTo: board ? `#/project/${projectId}/frames/${sceneId}` : `#/project/${projectId}/frames/${sceneId}/board`,
        right: `<button class="btn" data-action="add-video" data-project-id="${projectId}" data-scene-id="${sceneId}">+ Добавить видео</button>`,
      })}
      <div class="frame-layout">
        <section class="frame-canvas ${board ? "board" : "list"}">
          ${frames.length ? frames.map((frame) => renderFrameCard(frame, projectId, sceneId, selected)).join("") : `<div class="frame-empty full">Сцена пустая. Нажмите "+ Добавить видео".</div>`}
        </section>
        ${renderFramePanel(projectId, sceneId, selectedFrame)}
      </div>
      ${renderVideoModal(projectId, sceneId, selectedFrame)}
    </section>
  `;
}

function resolveFrameVideoSrc(frame) {
  if (!frame) return "";
  if (frame.video) return frame.video;
  return ui.localVideoUrlsByFrameId[frame.id] || "";
}

function frameSubtitle(frame, sceneId) {
  if (frame.localFileName) return frame.localFileName;
  if (frame.parentId) return "Версия";
  return sceneId;
}

function renderFrameCard(frame, projectId, sceneId, selected) {
  const markHex = getFrameColorHex(frame.markColor);
  const cls = `${frame.id === selected ? "selected" : ""} ${markHex ? "marked" : ""}`.trim();
  const videoSrc = resolveFrameVideoSrc(frame);
  const uploadBadge = frame.uploadStatus === "uploading"
    ? `<span class="frame-upload-badge">Загрузка...</span>`
    : frame.uploadStatus === "error"
      ? `<span class="frame-upload-badge error">Ошибка</span>`
      : frame.uploadStatus === "local"
        ? `<span class="frame-upload-badge local">Локально</span>`
        : "";
  const media = videoSrc
    ? `<video src="${escapeAttr(videoSrc)}" preload="metadata" muted playsinline></video>`
    : frame.image
      ? `<img src="${frame.image}" alt="${escapeAttr(frame.code)}"/>`
      : `<div class="frame-text">${escapeHtml(frame.text)}</div>`;

  return `
    <article class="frame-card ${cls}" style="${markHex ? `--frame-mark-color:${markHex};` : ""}" data-action="select-frame" data-project-id="${projectId}" data-scene-id="${sceneId}" data-id="${frame.id}">
      <div class="frame-thumb">
        ${media}
        ${markHex ? `<span class="frame-color-dot" style="background:${markHex}"></span>` : ""}
        ${videoSrc ? `<span class="frame-badge">Video</span>` : ""}
        ${uploadBadge}
      </div>
      <div class="frame-caption">
        <strong>${escapeHtml(frame.code)}</strong>
        <small>${escapeHtml(frameSubtitle(frame, sceneId))}</small>
      </div>
    </article>
  `;
}

function renderFramePanel(projectId, sceneId, frame) {
  if (!frame) return `<aside class="side-panel"><p class="empty">Нет видео в сцене. Добавьте первое видео.</p></aside>`;
  const comments = state.commentsByFrameId[frame.id] || [];
  const videoSrc = resolveFrameVideoSrc(frame);
  const localHint = frame.localFileName && !frame.video ? `<p class="hint">Локальный файл: ${escapeHtml(frame.localFileName)}</p>` : "";
  const uploadHint = frame.uploadStatus === "uploading"
    ? `<p class="hint">Идет загрузка в облако...</p>`
    : frame.uploadStatus === "local"
      ? `<p class="hint">Видео сохранено локально. Чтобы хранить в облаке, настройте Supabase Storage через Командный sync.</p>`
      : frame.uploadStatus === "error"
        ? `<p class="hint error">Ошибка загрузки: ${escapeHtml(frame.uploadError || "неизвестно")}</p>`
      : "";
  const colorControls = `
    <div class="color-palette">
      ${FRAME_COLOR_OPTIONS.map((c) => `<button class="color-btn ${frame.markColor === c.key ? "active" : ""}" title="${escapeAttr(c.label)}" data-action="set-frame-color" data-project-id="${projectId}" data-scene-id="${sceneId}" data-id="${frame.id}" data-color="${c.key}" style="--swatch:${c.hex};"></button>`).join("")}
      <button class="btn small ghost" data-action="set-frame-color" data-project-id="${projectId}" data-scene-id="${sceneId}" data-id="${frame.id}" data-color="">Сброс</button>
    </div>
  `;

  return `
    <aside class="side-panel">
      <h3>${escapeHtml(frame.code)}</h3>
      ${videoSrc ? `<video class="video-player" src="${escapeAttr(videoSrc)}" controls playsinline></video>` : `<div class="video-placeholder">Видео не добавлено. Загрузите файл кнопкой сверху.</div>`}
      ${localHint}
      ${uploadHint}
      <label class="field-label">Цвет кадра</label>
      ${colorControls}
      ${videoSrc ? `<button class="btn small" data-action="open-video-modal" data-id="${frame.id}">Большой просмотр</button>` : ""}
      <button class="btn small danger" data-action="remove-video" data-project-id="${projectId}" data-scene-id="${sceneId}" data-id="${frame.id}">Удалить видео</button>
      <div class="comment-block">
        <h4>Комментарии</h4>
        <div class="comment-list">${comments.length ? comments.map((c) => `<div class="comment-item">${escapeHtml(c)}</div>`).join("") : `<div class="comment-item">Комментариев нет</div>`}</div>
        <form data-form="comment" data-project-id="${projectId}" data-id="${frame.id}">
          <input class="input" name="comment" placeholder="Добавить комментарий"/>
          <button class="btn small" type="submit">Добавить</button>
        </form>
      </div>
    </aside>
  `;
}

function renderVideoModal(projectId, sceneId, frame) {
  if (!frame || ui.videoModalFrameId !== frame.id) return "";
  const videoSrc = resolveFrameVideoSrc(frame);
  if (!videoSrc) return "";

  return `
    <div class="video-modal">
      <div class="video-modal-backdrop" data-action="close-video-modal"></div>
      <div class="video-modal-dialog">
        <header class="video-modal-head">
          <strong>${escapeHtml(frame.code)} / ${escapeHtml(sceneId)}</strong>
          <button class="icon-btn" data-action="close-video-modal">×</button>
        </header>
        <video class="video-modal-player" src="${escapeAttr(videoSrc)}" controls autoplay playsinline></video>
      </div>
    </div>
  `;
}

async function addVideoToScene(projectId, sceneId, file) {
  if (!projectId || !sceneId || !file) return;
  if (!String(file.type || "").startsWith("video/")) {
    alert("Нужен видео-файл (video/*).");
    return;
  }

  const frames = getFrames(projectId, sceneId);
  const frameId = uid("f");
  const code = String(frames.length + 1).padStart(4, "0");
  const fileName = file.name || `video-${code}`;
  const text = fileName.replace(/\.[^/.]+$/, "");

  ui.localVideoUrlsByFrameId[frameId] = URL.createObjectURL(file);
  frames.push({
    id: frameId,
    code,
    sceneId,
    parentId: null,
    text,
    image: "",
    video: "",
    markColor: "",
    uploadStatus: "uploading",
    uploadError: "",
    localFileName: fileName,
  });
  ui.selectedFrameByScene[sceneKey(projectId, sceneId)] = frameId;
  saveState();
  renderCurrentRoute();

  if (!isVideoStorageConfigured()) {
    const frame = getFrames(projectId, sceneId).find((x) => x.id === frameId);
    if (!frame) return;
    frame.uploadStatus = "local";
    frame.uploadError = "";
    addActivity(projectId, `Видео ${fileName} добавлено локально (Supabase Storage не настроен)`, "info");
    saveState();
    renderCurrentRoute();
    return;
  }

  try {
    const remoteUrl = await uploadVideoToSupabase(file, projectId, sceneId, code);
    const frame = getFrames(projectId, sceneId).find((x) => x.id === frameId);
    if (!frame) return;
    frame.video = remoteUrl;
    frame.uploadStatus = "ready";
    frame.uploadError = "";
    if (ui.localVideoUrlsByFrameId[frameId]) {
      URL.revokeObjectURL(ui.localVideoUrlsByFrameId[frameId]);
      delete ui.localVideoUrlsByFrameId[frameId];
    }
    addActivity(projectId, `Видео ${fileName} загружено в облако`);
  } catch (error) {
    const frame = getFrames(projectId, sceneId).find((x) => x.id === frameId);
    if (!frame) return;
    frame.uploadStatus = "error";
    frame.uploadError = error instanceof Error ? error.message : "Ошибка загрузки";
    addActivity(projectId, `Ошибка загрузки ${fileName}`, "error");
    saveState();
  }
  renderCurrentRoute();
}

function setFrameColor(projectId, sceneId, frameId, colorKey) {
  const frames = getFrames(projectId, sceneId);
  const frame = frames.find((x) => x.id === frameId);
  if (!frame) return false;
  const valid = colorKey && getFrameColorHex(colorKey) ? colorKey : "";
  frame.markColor = valid;
  saveState();
  return true;
}

function removeFrameFromScene(projectId, sceneId, frameId) {
  if (!projectId || !sceneId || !frameId) return false;
  const key = sceneKey(projectId, sceneId);
  const frames = getFrames(projectId, sceneId);
  if (!frames.length) return false;

  const toDelete = new Set([frameId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const frame of frames) {
      if (frame.parentId && toDelete.has(frame.parentId) && !toDelete.has(frame.id)) {
        toDelete.add(frame.id);
        changed = true;
      }
    }
  }

  if (!toDelete.size) return false;

  for (const id of toDelete) {
    const url = ui.localVideoUrlsByFrameId[id];
    if (url) {
      URL.revokeObjectURL(url);
      delete ui.localVideoUrlsByFrameId[id];
    }
    delete state.commentsByFrameId[id];
    delete state.frameNotesById[id];
    if (ui.videoModalFrameId === id) ui.videoModalFrameId = "";
  }

  state.framesBySceneId[key] = frames.filter((f) => !toDelete.has(f.id));

  const nextSelected = state.framesBySceneId[key][0]?.id || "";
  ui.selectedFrameByScene[key] = nextSelected;
  addActivity(projectId, `Удалено видео (${toDelete.size}) из ${sceneId}`);
  return true;
}

function disposeSceneVideos(projectId, sceneId) {
  const frames = getFrames(projectId, sceneId);
  for (const frame of frames) {
    const url = ui.localVideoUrlsByFrameId[frame.id];
    if (url) {
      URL.revokeObjectURL(url);
      delete ui.localVideoUrlsByFrameId[frame.id];
    }
  }
}

function removeProjectData(projectId) {
  const exists = state.projects.some((p) => p.id === projectId);
  if (!exists) return false;

  const scenes = state.scenesByProjectId[projectId] || [];
  for (const scene of scenes) {
    const key = sceneKey(projectId, scene.id);
    const frames = state.framesBySceneId[key] || [];
    for (const frame of frames) {
      const url = ui.localVideoUrlsByFrameId[frame.id];
      if (url) {
        URL.revokeObjectURL(url);
        delete ui.localVideoUrlsByFrameId[frame.id];
      }
      delete state.commentsByFrameId[frame.id];
      delete state.frameNotesById[frame.id];
      if (ui.videoModalFrameId === frame.id) ui.videoModalFrameId = "";
    }
    delete ui.selectedFrameByScene[key];
    delete state.framesBySceneId[key];
  }

  delete state.budgetByProjectId[projectId];
  delete state.scriptsByProjectId[projectId];
  delete state.teamByProjectId[projectId];
  delete state.scenesByProjectId[projectId];
  delete state.tasksByModuleByProjectId[projectId];
  delete state.activityByProjectId[projectId];
  state.projects = state.projects.filter((p) => p.id !== projectId);

  if (ui.pendingVideoTarget?.projectId === projectId) ui.pendingVideoTarget = null;
  if (state.selectedProjectId === projectId) state.selectedProjectId = state.projects[0]?.id || "";
  saveState();
  return true;
}

function removeFolderData(folderId) {
  const exists = state.folders.some((f) => f.id === folderId);
  if (!exists) return false;

  const fallbackFolderId = state.folders.find((f) => f.id !== folderId)?.id || "";
  if (!fallbackFolderId) return false;
  for (const project of state.projects) {
    if (project.folderId === folderId) {
      project.folderId = fallbackFolderId;
      project.updatedAt = nowISO();
    }
  }
  state.folders = state.folders.filter((f) => f.id !== folderId);
  saveState();
  return true;
}

function renderTasks(projectId, moduleKey, title) {
  const project = getProject(projectId);
  if (!project) return renderNotFound();
  const tasks = getTasks(projectId, moduleKey);
  return `<section class="page">${renderTop(`${project.name} / ${title}`, { showBack: true, backTo: `#/project/${projectId}`, right: `<button class="btn" data-action="add-task" data-project-id="${projectId}" data-module="${moduleKey}">+ Задача</button>` })}<section class="table-panel"><table class="table"><thead><tr><th>Задача</th><th>Ответственный</th><th>Статус</th><th>Срок</th><th></th></tr></thead><tbody>${tasks.map((t) => `<tr><td><input class="table-input" data-bind="task" data-field="title" data-project-id="${projectId}" data-module="${moduleKey}" data-id="${t.id}" value="${escapeAttr(t.title)}" /></td><td><input class="table-input" data-bind="task" data-field="owner" data-project-id="${projectId}" data-module="${moduleKey}" data-id="${t.id}" value="${escapeAttr(t.owner)}" /></td><td><select class="table-input" data-bind="task" data-field="status" data-project-id="${projectId}" data-module="${moduleKey}" data-id="${t.id}">${TASK_STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === t.status ? "selected" : ""}>${s}</option>`).join("")}</select></td><td><input class="table-input" type="date" data-bind="task" data-field="due" data-project-id="${projectId}" data-module="${moduleKey}" data-id="${t.id}" value="${escapeAttr(t.due || "")}" /></td><td><button class="icon-btn" data-action="remove-task" data-project-id="${projectId}" data-module="${moduleKey}" data-id="${t.id}">×</button></td></tr>`).join("")}</tbody></table></section></section>`;
}

function renderRoute(route) {
  if (route.projectId && route.projectId !== state.selectedProjectId) {
    state.selectedProjectId = route.projectId;
    saveState();
  }

  switch (route.name) {
    case "home":
      return renderHome();
    case "project":
      return renderProject(route.projectId);
    case "estimate":
      return renderEstimate(route.projectId);
    case "script":
      return renderScript(route.projectId);
    case "admin":
      return renderAdmin(route.projectId);
    case "frames":
      return renderFrames(route.projectId);
    case "scene":
      return renderScene(route.projectId, route.sceneId, false);
    case "sceneBoard":
      return renderScene(route.projectId, route.sceneId, true);
    case "sound":
      return renderTasks(route.projectId, "sound", "Звук");
    case "edit":
      return renderTasks(route.projectId, "edit", "Монтаж");
    default:
      return renderNotFound();
  }
}

function renderCurrentRoute() {
  const app = document.getElementById("app");
  if (!app) return;
  currentRoute = routeFromHash(window.location.hash);
  app.innerHTML = renderRoute(currentRoute);
}

function moduleAsset(key) {
  return `assets/module-${key}.svg`;
}

function roleColor(role) {
  const palette = {
    "Ai-artist": "#7d33ff",
    Producer: "#3e8cff",
    Director: "#17a273",
    Editor: "#ca2aa8",
    Sound: "#d64a3d",
    Client: "#0ea5b7",
    Admin: "#ef8e00",
  };
  return palette[role] || "#8a8a8a";
}

function getFrameColorHex(colorKey) {
  return FRAME_COLOR_OPTIONS.find((x) => x.key === colorKey)?.hex || "";
}

function looksLikeJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
}

function normalizeSupabaseApiKey(key) {
  let value = String(key || "").trim();
  value = value.replace(/^["']|["']$/g, "");
  value = value.replace(/^Bearer\s+/i, "").trim();
  return value;
}

function normalizeSupabaseUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  const connMatch = value.match(/^postgres(?:ql)?:\/\/[^@]+@([^:/?#]+)(?::\d+)?/i);
  const rawHost = connMatch ? connMatch[1] : value.replace(/^https?:\/\//i, "").split("/")[0];
  let host = rawHost.toLowerCase();
  if (host.startsWith("db.")) host = host.slice(3);
  if (host.endsWith(".supabase.co")) {
    const projectRef = host.split(".")[0];
    if (projectRef) return `https://${projectRef}.supabase.co`;
  }
  return value
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/storage\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function isVideoStorageConfigured() {
  return Boolean(syncRuntime.cfg?.supabaseUrl && syncRuntime.cfg?.anonKey && syncRuntime.cfg?.storageBucket);
}

function videoStorageLabel() {
  if (!syncRuntime.cfg?.supabaseUrl) return "Supabase Storage не настроен";
  return isVideoStorageConfigured()
    ? `Supabase Storage: bucket ${syncRuntime.cfg.storageBucket}`
    : "Supabase Storage: задайте bucket в Командный sync";
}

function storageObjectPath(projectId, sceneId, frameCode, fileName) {
  const safeName = String(fileName || `video_${frameCode}.mp4`)
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${syncRuntime.cfg.workspaceId}/${projectId}/${sceneId}/${frameCode}_${Date.now()}_${safeName}`;
}

function storagePublicUrl(baseUrl, bucket, objectPath) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedPath = objectPath.split("/").map((x) => encodeURIComponent(x)).join("/");
  return `${normalizedBase}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

async function uploadVideoToSupabase(file, projectId, sceneId, frameCode) {
  const cfg = syncRuntime.cfg;
  if (!cfg?.supabaseUrl || !cfg?.anonKey || !cfg?.storageBucket) {
    throw new Error("Сначала настройте Командный sync и bucket хранилища.");
  }
  const base = normalizeSupabaseUrl(cfg.supabaseUrl);
  const key = normalizeSupabaseApiKey(cfg.anonKey || "");
  const objectPath = storageObjectPath(projectId, sceneId, frameCode, file.name);
  const encodedPath = objectPath.split("/").map((x) => encodeURIComponent(x)).join("/");
  const endpoint = `${base}/storage/v1/object/${encodeURIComponent(cfg.storageBucket)}/${encodedPath}?upsert=true`;
  const headers = {
    apikey: key,
    "Content-Type": file.type || "application/octet-stream",
    "x-upsert": "true",
  };
  if (looksLikeJwt(key)) headers.Authorization = `Bearer ${key}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: file,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const compact = String(text || "").slice(0, 300);
    const low = compact.toLowerCase();
    const message = low.includes("unknown api key")
      ? "Unknown API key. Проверьте Supabase anon/publishable key в Командный sync."
      : low.includes("bucket not found")
        ? `Bucket "${cfg.storageBucket}" не найден. Создайте его в Supabase Storage или укажите правильное имя в Командный sync.`
        : (low.includes("row-level security policy") || (low.includes("unauthorized") && resp.status === 403))
          ? `Нет прав записи в bucket "${cfg.storageBucket}" (RLS). Добавьте policy INSERT/UPDATE для роли anon в Supabase Storage.`
        : compact || `Storage upload error: ${resp.status}`;
    throw new Error(message);
  }

  return storagePublicUrl(base, cfg.storageBucket, objectPath);
}

function renderModulePreview(projectId, moduleKey) {
  if (moduleKey === "estimate") {
    const rows = getBudget(projectId).slice(0, 4);
    return `
      <div class="module-preview estimate-preview">
        <div class="mini-sheet">
          <div class="mini-sheet-head"><span>Работы</span><span>Итого</span></div>
          ${rows.map((r) => `<div class="mini-sheet-row"><span>${escapeHtml(r.title)}</span><strong>${currency((Number(r.cost) || 0) + ((Number(r.cost) || 0) * (Number(r.markup) || 0)) / 100)}</strong></div>`).join("")}
        </div>
      </div>
    `;
  }

  if (moduleKey === "script") {
    const blocks = getScript(projectId).slice(0, 3);
    return `
      <div class="module-preview script-preview">
        ${blocks.map((b) => `<article class="mini-script-card"><h4>${escapeHtml(b.title)}</h4><p>${escapeHtml(b.text || "Без текста")}</p></article>`).join("")}
      </div>
    `;
  }

  if (moduleKey === "admin") {
    const team = getTeam(projectId).slice(0, 5);
    return `
      <div class="module-preview admin-preview">
        ${team.map((m) => `<div class="mini-member-row"><span class="mini-avatar">${escapeHtml(initials(m.name))}</span><span class="mini-name">${escapeHtml(m.name)}</span><span class="mini-role" style="background:${roleColor(m.role)}">${escapeHtml(m.role)}</span></div>`).join("")}
      </div>
    `;
  }

  if (moduleKey === "frames") {
    const scenes = getScenes(projectId);
    const items = [];
    for (const scene of scenes) {
      const frames = getFrames(projectId, scene.id);
      for (const frame of frames) {
        items.push({ ...frame, sceneName: scene.name });
        if (items.length >= 3) break;
      }
      if (items.length >= 3) break;
    }

    return `
      <div class="module-preview frames-preview">
        ${items.length ? items.map((f, idx) => {
          const src = resolveFrameVideoSrc(f);
          const media = src
            ? `<video src="${escapeAttr(src)}" muted playsinline preload="metadata"></video>`
            : f.image
              ? `<img src="${escapeAttr(f.image)}" alt="${escapeAttr(f.code)}" />`
              : `<div class="mini-frame-fallback">${escapeHtml(f.code)}</div>`;
          return `<div class="mini-frame-tile tile-${idx + 1}">${media}</div>`;
        }).join("") : `<div class="mini-preview-empty">Нет кадров</div>`}
        <div class="mini-frames-meta">${items.length} видео</div>
      </div>
    `;
  }

  return `<div class="module-preview asset-preview" style="background-image:url('${moduleAsset(moduleKey)}')"></div>`;
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("") || "U";
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(v) {
  return escapeHtml(v).replaceAll("`", "&#96;");
}

function getByBind(bind, projectId, moduleKey, sceneId) {
  switch (bind) {
    case "budget":
      return getBudget(projectId);
    case "script":
      return getScript(projectId);
    case "team":
      return getTeam(projectId);
    case "scene":
      return getScenes(projectId);
    case "frame":
      return getFrames(projectId, sceneId);
    case "task":
      return getTasks(projectId, moduleKey);
    default:
      return null;
  }
}

function coerceValue(field, raw) {
  if (["cost", "markup", "hoursLeft", "progress"].includes(field)) {
    const num = Number(raw);
    if (!Number.isFinite(num)) return 0;
    if (field === "progress") return Math.max(0, Math.min(100, num));
    return num;
  }
  return raw;
}

function updateBoundField(input) {
  const bind = input.dataset.bind;
  const projectId = input.dataset.projectId;
  const moduleKey = input.dataset.module;
  const sceneId = input.dataset.sceneId;
  const id = input.dataset.id;
  const field = input.dataset.field;
  if (!bind || !id || !field) return;

  if (bind === "project") {
    const project = state.projects.find((item) => item.id === id);
    if (!project) return;
    project[field] = coerceValue(field, input.value);
    project.updatedAt = nowISO();
    saveState();
    return;
  }

  if (!projectId) return;

  const list = getByBind(bind, projectId, moduleKey, sceneId);
  if (!Array.isArray(list)) return;
  const item = list.find((x) => x.id === id);
  if (!item) return;

  item[field] = coerceValue(field, input.value);
  saveState();
}

function updateFolderName(folderId, rawName, options = {}) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder) return false;
  const nextName = options.commit
    ? (String(rawName || "").trim() || "Новая папка")
    : String(rawName || "");
  folder.name = nextName;
  if (options.commit) saveState();
  return true;
}

function handleAction(actionEl) {
  const action = actionEl.dataset.action;
  if (!action) return;

  if (action === "open-project") {
    const projectId = actionEl.dataset.projectId;
    if (projectId) navigate(`#/project/${projectId}`);
    return;
  }

  if (action === "rename-project") {
    const projectId = actionEl.dataset.projectId;
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) return;
    const nextName = prompt("Новое название проекта:", project.name || "");
    if (nextName === null) return;
    project.name = String(nextName || "").trim() || project.name || "Новый проект";
    project.updatedAt = nowISO();
    saveState();
    if (currentRoute?.name === "home") renderCurrentRoute();
    return;
  }

  if (action === "new-project") {
    const idx = state.projects.length + 1;
    const id = uid("p");
    const folderId = state.folders[0]?.id || "";
    const previewId = ((idx - 1) % 6) + 1;
    const project = {
      id,
      name: `Новый проект ${idx}`,
      tag: "Ai",
      client: "Новый клиент",
      status: "Draft",
      updatedAt: nowISO(),
      folderId,
      preview: [{ src: `assets/project-${previewId}.svg`, x: 8, y: 16, w: 84, h: 64 }],
    };
    state.projects.unshift(project);
    ensureProjectStore(state, id);
    state.scenesByProjectId[id].push({ id: "scene-01", name: "Scene_01", owner: "Owner", progress: 0 });
    state.framesBySceneId[sceneKey(id, "scene-01")] = [{ id: uid("f"), code: "0010", sceneId: "scene-01", parentId: null, text: "Новый кадр", image: "", markColor: "" }];
    state.selectedProjectId = id;
    addActivity(id, "Создан новый проект", "create");
    saveState();
    navigate(`#/project/${id}`);
    return;
  }

  if (action === "new-folder") {
    const defaultName = `Новая папка ${state.folders.length + 1}`;
    const name = prompt("Название папки:", defaultName);
    if (!name) return;
    state.folders.push({ id: uid("folder"), name: name.trim() || defaultName });
    saveState();
    renderCurrentRoute();
    return;
  }

  if (action === "configure-sync") {
    const cfg = syncRuntime.cfg || loadSyncConfig() || {};
    const supabaseUrl = prompt("Supabase URL (https://YOUR_PROJECT.supabase.co):", cfg.supabaseUrl || "");
    if (supabaseUrl === null) return;
    const anonKey = prompt("Supabase anon key:", cfg.anonKey || "");
    if (anonKey === null) return;
    const storageBucket = prompt("Supabase Storage bucket (например videos):", cfg.storageBucket || SUPABASE_STORAGE_DEFAULT_BUCKET);
    if (storageBucket === null) return;
    const workspaceId = prompt("Workspace ID (общий для команды):", cfg.workspaceId || "team-main");
    if (workspaceId === null) return;
    const defaultDevice = cfg.deviceName || `device-${uid("d").slice(-4)}`;
    const deviceName = prompt("Имя устройства (для логов):", defaultDevice);
    if (deviceName === null) return;

    const nextCfg = {
      supabaseUrl: normalizeSupabaseUrl(supabaseUrl.trim()),
      anonKey: normalizeSupabaseApiKey(anonKey),
      storageBucket: (storageBucket || SUPABASE_STORAGE_DEFAULT_BUCKET).trim() || SUPABASE_STORAGE_DEFAULT_BUCKET,
      workspaceId: (workspaceId || "team-main").trim() || "team-main",
      deviceName: (deviceName || defaultDevice).trim() || defaultDevice,
    };

    if (!nextCfg.supabaseUrl || !nextCfg.anonKey || !nextCfg.storageBucket) {
      alert("Нужно заполнить Supabase URL, anon key и bucket.");
      return;
    }
    if (!/^https?:\/\//i.test(nextCfg.supabaseUrl)) {
      alert("Supabase URL должен быть вида https://YOUR_PROJECT.supabase.co.");
      return;
    }

    saveSyncConfig(nextCfg);
    renderCurrentRoute();
    connectSync().then(() => renderCurrentRoute());
    return;
  }

  if (action === "sync-now") {
    if (!isSyncConfigured()) {
      alert("Сначала настройте Командный sync.");
      return;
    }
    pullRemoteState({ apply: true }).then(() => pushRemoteState("manual")).then(() => renderCurrentRoute());
    return;
  }

  if (action === "remove-folder") {
    const folderId = actionEl.dataset.folderId;
    if (!folderId) return;
    if (state.folders.length <= 1) {
      alert("Нельзя удалить последнюю папку.");
      return;
    }
    if (!confirm("Удалить папку? Проекты из нее будут перенесены в другую папку.")) return;
    if (removeFolderData(folderId)) renderCurrentRoute();
    return;
  }

  if (action === "remove-project") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    if (!confirm("Удалить проект полностью? Это действие нельзя отменить.")) return;
    if (removeProjectData(projectId)) navigate("#/home");
    return;
  }

  if (action === "remove-home-project") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    if (!confirm("Удалить проект с главного экрана? Данные проекта будут удалены.")) return;
    if (removeProjectData(projectId)) renderCurrentRoute();
    return;
  }

  if (action === "clear-activity") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    state.activityByProjectId[projectId] = [];
    saveState();
    renderCurrentRoute();
    return;
  }

  if (action === "add-budget-row") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    getBudget(projectId).push({ id: uid("b"), title: "Новая работа", specialist: "", cost: 0, markup: 0 });
    addActivity(projectId, "Добавлена строка сметы");
    renderCurrentRoute();
    return;
  }

  if (action === "remove-budget-row") {
    const projectId = actionEl.dataset.projectId;
    const id = actionEl.dataset.id;
    if (!projectId || !id) return;
    state.budgetByProjectId[projectId] = getBudget(projectId).filter((x) => x.id !== id);
    addActivity(projectId, "Удалена строка сметы");
    renderCurrentRoute();
    return;
  }

  if (action === "add-script") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    getScript(projectId).push({ id: uid("s"), title: "Новый блок", duration: "", status: "Draft", text: "" });
    addActivity(projectId, "Добавлен блок сценария");
    renderCurrentRoute();
    return;
  }

  if (action === "remove-script") {
    const projectId = actionEl.dataset.projectId;
    const id = actionEl.dataset.id;
    if (!projectId || !id) return;
    state.scriptsByProjectId[projectId] = getScript(projectId).filter((x) => x.id !== id);
    addActivity(projectId, "Удален блок сценария");
    renderCurrentRoute();
    return;
  }

  if (action === "add-team") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    getTeam(projectId).push({ id: uid("t"), name: "Новый участник", role: "Ai-artist", hoursLeft: 40, rights: "comment" });
    addActivity(projectId, "Добавлен участник");
    renderCurrentRoute();
    return;
  }

  if (action === "remove-team") {
    const projectId = actionEl.dataset.projectId;
    const id = actionEl.dataset.id;
    if (!projectId || !id) return;
    state.teamByProjectId[projectId] = getTeam(projectId).filter((x) => x.id !== id);
    addActivity(projectId, "Удален участник");
    renderCurrentRoute();
    return;
  }

  if (action === "add-scene") {
    const projectId = actionEl.dataset.projectId;
    if (!projectId) return;
    const num = getScenes(projectId).length + 1;
    const sceneId = `scene-${String(num).padStart(2, "0")}`;
    getScenes(projectId).push({ id: sceneId, name: `Scene_${String(num).padStart(2, "0")}`, owner: "Owner", progress: 0 });
    state.framesBySceneId[sceneKey(projectId, sceneId)] = [];
    addActivity(projectId, `Добавлена ${sceneId}`);
    renderCurrentRoute();
    return;
  }

  if (action === "remove-scene") {
    const projectId = actionEl.dataset.projectId;
    const id = actionEl.dataset.id;
    if (!projectId || !id) return;
    disposeSceneVideos(projectId, id);
    state.scenesByProjectId[projectId] = getScenes(projectId).filter((x) => x.id !== id);
    delete state.framesBySceneId[sceneKey(projectId, id)];
    addActivity(projectId, `Удалена ${id}`);
    renderCurrentRoute();
    return;
  }

  if (action === "open-scene") {
    const projectId = actionEl.dataset.projectId;
    const sceneId = actionEl.dataset.sceneId;
    if (projectId && sceneId) navigate(`#/project/${projectId}/frames/${sceneId}`);
    return;
  }

  if (action === "select-frame") {
    const projectId = actionEl.dataset.projectId;
    const sceneId = actionEl.dataset.sceneId;
    const id = actionEl.dataset.id;
    if (!projectId || !sceneId || !id) return;
    ui.selectedFrameByScene[sceneKey(projectId, sceneId)] = id;
    ui.videoModalFrameId = "";
    renderCurrentRoute();
    return;
  }

  if (action === "add-video") {
    const projectId = actionEl.dataset.projectId;
    const sceneId = actionEl.dataset.sceneId;
    if (!projectId || !sceneId) return;
    ui.pendingVideoTarget = { projectId, sceneId };
    const input = document.getElementById("videoUploadInput");
    if (input) input.click();
    return;
  }

  if (action === "open-video-modal") {
    const id = actionEl.dataset.id;
    if (!id) return;
    ui.videoModalFrameId = id;
    renderCurrentRoute();
    return;
  }

  if (action === "close-video-modal") {
    ui.videoModalFrameId = "";
    renderCurrentRoute();
    return;
  }

  if (action === "set-frame-color") {
    const projectId = actionEl.dataset.projectId;
    const sceneId = actionEl.dataset.sceneId;
    const id = actionEl.dataset.id;
    const colorKey = actionEl.dataset.color || "";
    if (!projectId || !sceneId || !id) return;
    if (setFrameColor(projectId, sceneId, id, colorKey)) renderCurrentRoute();
    return;
  }

  if (action === "remove-video") {
    const projectId = actionEl.dataset.projectId;
    const sceneId = actionEl.dataset.sceneId;
    const id = actionEl.dataset.id;
    if (!projectId || !sceneId || !id) return;
    if (!confirm("Удалить это видео из сцены?")) return;
    if (removeFrameFromScene(projectId, sceneId, id)) renderCurrentRoute();
    return;
  }

  if (action === "add-version") {
    const projectId = actionEl.dataset.projectId;
    const sceneId = actionEl.dataset.sceneId;
    const baseId = actionEl.dataset.id;
    if (!projectId || !sceneId || !baseId) return;
    const frames = getFrames(projectId, sceneId);
    const base = frames.find((x) => x.id === baseId);
    if (!base) return;
    const siblings = frames.filter((x) => x.parentId === baseId);
    const ver = siblings.length + 1;
    const code = `${base.code}_V${ver}`;
    const image = ver <= 3 ? `assets/frame-0050-v${ver}.svg` : "";
    const frameId = uid("f");
    frames.push({ id: frameId, code, sceneId, parentId: baseId, text: `Версия ${ver}`, image, markColor: "" });
    ui.selectedFrameByScene[sceneKey(projectId, sceneId)] = frameId;
    addActivity(projectId, `Добавлена версия ${code}`);
    renderCurrentRoute();
    return;
  }

  if (action === "save-note") {
    const frameId = actionEl.dataset.id;
    if (!frameId) return;
    const textarea = document.querySelector(`[data-note][data-id="${frameId}"]`);
    updateFrameNote(frameId, textarea?.value || "");
    renderCurrentRoute();
    return;
  }

  if (action === "add-task") {
    const projectId = actionEl.dataset.projectId;
    const moduleKey = actionEl.dataset.module;
    if (!projectId || !moduleKey) return;
    getTasks(projectId, moduleKey).push({ id: uid("task"), title: "Новая задача", owner: "", status: "todo", due: "" });
    addActivity(projectId, `Добавлена задача (${moduleKey})`);
    renderCurrentRoute();
    return;
  }

  if (action === "remove-task") {
    const projectId = actionEl.dataset.projectId;
    const moduleKey = actionEl.dataset.module;
    const id = actionEl.dataset.id;
    if (!projectId || !moduleKey || !id) return;
    state.tasksByModuleByProjectId[projectId][moduleKey] = getTasks(projectId, moduleKey).filter((x) => x.id !== id);
    addActivity(projectId, `Удалена задача (${moduleKey})`);
    renderCurrentRoute();
    return;
  }

  if (action === "export") {
    exportState();
    return;
  }

  if (action === "import") {
    const input = document.getElementById("stateImportInput");
    if (input) input.click();
  }
}

function updateComment(frameId, text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (!state.commentsByFrameId[frameId]) state.commentsByFrameId[frameId] = [];
  state.commentsByFrameId[frameId].unshift(value);
  state.commentsByFrameId[frameId] = state.commentsByFrameId[frameId].slice(0, 60);
  saveState();
  return true;
}

function updateFrameNote(frameId, text) {
  state.frameNotesById[frameId] = String(text || "");
  saveState();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vistaboard-state-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importStateFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state = normalizeState(parsed);
      saveState();
      renderCurrentRoute();
    } catch (_e) {
      alert("Не удалось импортировать JSON.");
    }
  };
  reader.readAsText(file, "utf-8");
}

function bindGlobalEvents() {
  document.addEventListener("click", (event) => {
    const navEl = event.target.closest("[data-nav]");
    if (navEl) {
      event.preventDefault();
      navigate(navEl.dataset.nav);
      return;
    }
    const actionEl = event.target.closest("[data-action]");
    if (actionEl) {
      event.preventDefault();
      handleAction(actionEl);
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form='comment']");
    if (!form) return;
    event.preventDefault();
    const frameId = form.dataset.id;
    const input = form.querySelector("input[name='comment']");
    if (!frameId || !input) return;
    if (updateComment(frameId, input.value)) {
      input.value = "";
      renderCurrentRoute();
    }
  });

  document.addEventListener("input", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;

    if (el.matches("[data-search]")) {
      ui.search = el.value;
      if (currentRoute?.name === "home") renderCurrentRoute();
      return;
    }

    if (el.matches("[data-folder-name]")) {
      updateFolderName(el.dataset.folderId, el.value, { commit: false });
      return;
    }

    if (el.matches("[data-bind]")) {
      updateBoundField(el);
    }
  });

  document.addEventListener("change", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;

    if (el.matches("[data-project-folder]")) {
      const projectId = el.dataset.projectId;
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return;
      project.folderId = el.value || "";
      project.updatedAt = nowISO();
      saveState();
      if (currentRoute?.name === "home") renderCurrentRoute();
      return;
    }

    if (el.matches("[data-folder-name]")) {
      if (updateFolderName(el.dataset.folderId, el.value, { commit: true })) {
        el.value = state.folders.find((folder) => folder.id === el.dataset.folderId)?.name || el.value;
        if (currentRoute?.name === "home") renderCurrentRoute();
      }
      return;
    }

    if (el.matches("[data-bind]")) {
      updateBoundField(el);
      if (el.dataset.bind === "frame" && el.dataset.field === "video") renderCurrentRoute();
    }
  });

  const importInput = document.getElementById("stateImportInput");
  if (importInput) {
    importInput.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      importStateFromFile(target.files?.[0] || null);
      target.value = "";
    });
  }

  const videoInput = document.getElementById("videoUploadInput");
  if (videoInput) {
    videoInput.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const file = target.files?.[0] || null;
      const pending = ui.pendingVideoTarget;
      if (file && pending) await addVideoToScene(pending.projectId, pending.sceneId, file);
      ui.pendingVideoTarget = null;
      target.value = "";
    });
  }

  window.addEventListener("hashchange", renderCurrentRoute);
}

function initApp() {
  bindGlobalEvents();
  syncRuntime.cfg = loadSyncConfig();
  if (isSyncConfigured()) connectSync().then(() => renderCurrentRoute());
  if (!window.location.hash) {
    navigate("#/home");
    return;
  }
  renderCurrentRoute();
}

window.initApp = initApp;
window.navigate = navigate;
window.renderRoute = renderRoute;
window.loadState = loadState;
window.saveState = saveState;
window.updateComment = updateComment;
window.updateFrameNote = updateFrameNote;

initApp();
