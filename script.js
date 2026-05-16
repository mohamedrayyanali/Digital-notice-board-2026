const KEY = "dnb_static_v1";
const board = document.getElementById("board");
const canvas = document.getElementById("drawLayer");
const ctx = canvas.getContext("2d");
const clockEl = document.getElementById("clock");
const calEl = document.getElementById("calendar");
const tzEl = document.getElementById("timezone");
const zoomLabel = document.getElementById("zoomLabel");
const sketchToggleBtn = document.getElementById("sketchToggle");

const zones = ["UTC", "Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];
let state = loadState();
let dragging = null;
let resizing = null;
let drawDown = false;
let audioCtx;

function loadState() {
  const base = { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", dark: false, sound: false, zoom: 1, notes: [], images: [], drawing: "", tool: "pen", color: "#0F172A", size: 4, sketchEnabled: false };
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return base; }
}
function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }

function updateTime() {
  const now = new Date();
  clockEl.textContent = new Intl.DateTimeFormat("en-US", { timeZone: state.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now);
  calEl.textContent = new Intl.DateTimeFormat("en-US", { timeZone: state.timezone, weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(now);
}

function applyTheme() { document.body.classList.toggle("dark", state.dark); }
function applyZoom() { board.style.transform = `scale(${state.zoom})`; board.style.transformOrigin = "top left"; zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`; }
function applySketchMode() {
  canvas.style.pointerEvents = state.sketchEnabled ? "auto" : "none";
  sketchToggleBtn.textContent = state.sketchEnabled ? "Sketch On" : "Sketch Off";
  sketchToggleBtn.classList.toggle("sketch-on", state.sketchEnabled);
}
function beep() {
  if (!state.sound) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = "triangle"; o.frequency.value = 760; g.gain.value = 0.04; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.06);
}

function setCanvasSize() {
  canvas.width = board.clientWidth;
  canvas.height = board.clientHeight;
  redrawSavedDrawing();
}
function redrawSavedDrawing() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.drawing) return;
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0);
  img.src = state.drawing;
}

function makeId() { return `${Date.now()}-${Math.random()}`; }

function createItem(type, data) {
  const el = document.createElement("div");
  el.className = "item";
  el.dataset.id = data.id;
  el.dataset.type = type;
  el.style.left = `${data.x}px`;
  el.style.top = `${data.y}px`;
  el.style.width = `${data.w}px`;
  el.style.height = `${data.h}px`;
  if (type === "note") el.style.background = data.color;

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.innerHTML = `<span class="pin"></span><div><button class="pinBtn">Pin</button> <button class="delBtn">Delete</button></div>`;
  const delBtn = bar.querySelector(".delBtn");
  delBtn.onclick = () => removeItem(type, data.id);
  bar.querySelector(".pinBtn").onclick = () => { data.pinned = !data.pinned; beep(); saveState(); };
  bar.onpointerdown = (e) => { dragging = { el, id: data.id, type, ox: e.clientX - data.x, oy: e.clientY - data.y }; };
  el.appendChild(bar);

  if (type === "note") {
    const ta = document.createElement("textarea");
    ta.value = data.text;
    ta.oninput = () => { data.text = ta.value; saveState(); };
    el.appendChild(ta);
  } else {
    const img = document.createElement("img");
    img.src = data.src;
    el.appendChild(img);
  }

  const handle = document.createElement("span");
  handle.className = "handle";
  handle.onpointerdown = (e) => { e.stopPropagation(); resizing = { el, id: data.id, type, sx: e.clientX, sy: e.clientY, sw: data.w, sh: data.h }; };
  el.appendChild(handle);
  board.appendChild(el);
}

function removeItem(type, id) {
  state[type === "note" ? "notes" : "images"] = state[type === "note" ? "notes" : "images"].filter((x) => x.id !== id);
  board.querySelector(`.item[data-id="${id}"]`)?.remove();
  saveState();
}

function renderItems() {
  board.querySelectorAll(".item").forEach((n) => n.remove());
  state.notes.forEach((n) => createItem("note", n));
  state.images.forEach((i) => createItem("image", i));
}

document.addEventListener("pointermove", (e) => {
  if (dragging) {
    const arr = dragging.type === "note" ? state.notes : state.images;
    const obj = arr.find((x) => x.id === dragging.id);
    if (!obj) return;
    obj.x = Math.max(0, e.clientX - dragging.ox - board.getBoundingClientRect().left);
    obj.y = Math.max(0, e.clientY - dragging.oy - board.getBoundingClientRect().top);
    dragging.el.style.left = `${obj.x}px`;
    dragging.el.style.top = `${obj.y}px`;
    saveState();
  }
  if (resizing) {
    const arr = resizing.type === "note" ? state.notes : state.images;
    const obj = arr.find((x) => x.id === resizing.id);
    if (!obj) return;
    obj.w = Math.max(120, resizing.sw + (e.clientX - resizing.sx));
    obj.h = Math.max(100, resizing.sh + (e.clientY - resizing.sy));
    resizing.el.style.width = `${obj.w}px`;
    resizing.el.style.height = `${obj.h}px`;
    saveState();
  }
  if (drawDown) {
    if (!state.sketchEnabled) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }
});
document.addEventListener("pointerup", () => {
  dragging = null; resizing = null;
  if (drawDown) {
    drawDown = false;
    state.drawing = canvas.toDataURL("image/png");
    saveState();
  }
});

canvas.onpointerdown = (e) => {
  if (!state.sketchEnabled) return;
  drawDown = true;
  const r = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  ctx.lineCap = "round";
  ctx.lineWidth = state.size;
  ctx.strokeStyle = state.tool === "eraser" ? "#d8b58a" : state.color;
};

document.querySelectorAll(".note-color").forEach((btn) => btn.onclick = () => {
  const n = { id: makeId(), x: 40 + state.notes.length * 12, y: 120 + state.notes.length * 12, w: 220, h: 180, text: "New idea...", color: btn.dataset.color, pinned: false };
  state.notes.push(n); createItem("note", n); saveState();
});
document.getElementById("uploadInput").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = () => { const i = { id: makeId(), src: fr.result, x: 100, y: 140, w: 240, h: 180, pinned: true }; state.images.push(i); createItem("image", i); saveState(); };
  fr.readAsDataURL(f); e.target.value = "";
};
document.getElementById("themeBtn").onclick = () => { state.dark = !state.dark; applyTheme(); saveState(); };
document.getElementById("soundBtn").onclick = () => { state.sound = !state.sound; document.getElementById("soundBtn").textContent = state.sound ? "Sound On" : "Sound Off"; saveState(); };
document.getElementById("zoomIn").onclick = () => { state.zoom = Math.min(1.6, state.zoom + 0.1); applyZoom(); saveState(); };
document.getElementById("zoomOut").onclick = () => { state.zoom = Math.max(0.6, state.zoom - 0.1); applyZoom(); saveState(); };
document.getElementById("clearCanvas").onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); state.drawing = ""; saveState(); };
sketchToggleBtn.onclick = () => { state.sketchEnabled = !state.sketchEnabled; applySketchMode(); saveState(); };
document.getElementById("penBtn").onclick = () => { state.tool = "pen"; saveState(); };
document.getElementById("eraserBtn").onclick = () => { state.tool = "eraser"; saveState(); };
document.getElementById("brushSize").oninput = (e) => { state.size = Number(e.target.value); saveState(); };
document.querySelectorAll(".draw-color").forEach((btn) => btn.onclick = () => { state.color = btn.dataset.color; state.tool = "pen"; saveState(); });
document.getElementById("exportBtn").onclick = async () => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${board.clientWidth}' height='${board.clientHeight}'><foreignObject width='100%' height='100%'>${new XMLSerializer().serializeToString(board.cloneNode(true))}</foreignObject></svg>`;
  const img = new Image();
  img.onload = () => {
    const out = document.createElement("canvas");
    out.width = board.clientWidth; out.height = board.clientHeight;
    out.getContext("2d").drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.download = `notice-board-${Date.now()}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

zones.forEach((z) => {
  const op = document.createElement("option");
  op.value = z; op.textContent = z; tzEl.appendChild(op);
});
tzEl.value = state.timezone;
tzEl.onchange = () => { state.timezone = tzEl.value; updateTime(); saveState(); };

applyTheme();
document.getElementById("soundBtn").textContent = state.sound ? "Sound On" : "Sound Off";
applyZoom();
applySketchMode();
setCanvasSize();
renderItems();
updateTime();
setInterval(updateTime, 1000);
window.addEventListener("resize", setCanvasSize);
