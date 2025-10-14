function cls(verdict){
  if (verdict === "green") return "v-green";
  if (verdict === "yellow") return "v-yellow";
  if (verdict === "red") return "v-red";
  return "v-none";
}
function humanVerdict(v){
  if (v === "green") return "GREEN";
  if (v === "yellow") return "YELLOW";
  if (v === "red") return "RED";
  return "NONE";
}
function verdictNote(modality, verdict, score){
  const pct = Math.round((Number(score||0)) * 100);
  if (verdict === "green")  return `This ${modality} is likely human-authored/recorded (confidence score ${pct}/100).`;
  if (verdict === "yellow") return `This ${modality} shows some AI-like patterns (score ${pct}/100). Review carefully.`;
  if (verdict === "red")    return `This ${modality} is likely AI-generated or manipulated (score ${pct}/100).`;
  return `No sufficient ${modality.toLowerCase()} found to analyze.`;
}

function pill(label){ const el=document.createElement("div"); el.className="pill"; el.textContent=label; return el; }
function addReasons(ul,res,label){
  if (!res || res.verdict === "none") return;
  const header = document.createElement("li");
  header.style.listStyle="none"; header.style.marginLeft="-18px";
  header.innerHTML = `<span class="${cls(res.verdict)}" style="font-weight:600">${label} • ${humanVerdict(res.verdict)}</span>`;
  ul.appendChild(header);

  const expl = document.createElement("li");
  expl.style.listStyle = "none";
  expl.style.marginLeft = "-18px";
  expl.style.color = "#9bb0d1";
  expl.textContent = verdictNote(label.toLowerCase(), res.verdict, res.score);
  ul.appendChild(expl);

  (res.reason || []).forEach(r=>{ const li=document.createElement("li"); li.textContent=r; ul.appendChild(li); });
}

let scanning = false;
function setScanningUI(active, meta){
  const btn = document.getElementById("scan");
  const spin = document.getElementById("spin");
  const txt = document.getElementById("scantext");
  const bar = document.getElementById("scanning");
  scanning = !!active;
  btn.disabled = scanning;
  spin.style.display = scanning ? "inline-block" : "none";
  txt.textContent = scanning ? "Scanning…" : "Scan again";
  if (scanning){
    const what = meta?.what?.source_hint || "page";
    const tlen = meta?.what?.counts?.text_chars || 0;
    const imgs = meta?.what?.counts?.images || 0;
    const vids = meta?.what?.counts?.videos || 0;
    bar.textContent = `Scanning ${what}… (text ${tlen} chars, images ${imgs}, videos ${vids})`;
    bar.style.display = "block";
  } else {
    bar.style.display = "none";
  }
}

function render(result){
  const verdictEl = document.getElementById("verdict");
  const reasonsEl = document.getElementById("reasons");
  const pills = document.getElementById("pills");
  const note = document.getElementById("note");
  reasonsEl.innerHTML = ""; pills.innerHTML = ""; note.textContent = "";

  if (!result){
    verdictEl.className = "verdict v-none";
    verdictEl.textContent = "No scan yet";
    note.textContent = "Click Scan to analyze this page.";
    return;
  }
  verdictEl.className = "verdict " + cls(result.overall || "none");
  verdictEl.textContent = `Verdict: ${humanVerdict(result.overall)} (${result.winner || "n/a"})`;

  const sc = result.scanned || {};
  if (sc.hasText)   pills.appendChild(pill("Text"));
  if (sc.hasImages) pills.appendChild(pill("Images"));
  if (sc.hasVideo)  pills.appendChild(pill("Video"));
  if (result.modalities?.audio_present) pills.appendChild(pill("Audio (present)"));

  const m = result.modalities || {};
  const first = (result.winner === "text") ? m.text : m.visual;
  const second = (result.winner === "text") ? m.visual : m.text;
  addReasons(reasonsEl, first, result.winner === "text" ? "Text" : "Visual");
  addReasons(reasonsEl, second, result.winner === "text" ? "Visual" : "Text");

  if (!sc.hasText && !sc.hasImages && !sc.hasVideo){
    verdictEl.className = "verdict v-none";
    verdictEl.textContent = "Nothing to analyze here";
    note.textContent = "No sizable text, images, or video found.";
  } else {
    const ov = document.createElement("div");
    ov.className = "muted";
    const winnerLabel = result.winner === "text" ? "text" : "visual content";
    if (["green","yellow","red"].includes(result.overall)) {
      ov.textContent = `Overall verdict is ${humanVerdict(result.overall)} based on ${winnerLabel}.`;
    } else {
      ov.textContent = `Overall verdict is inconclusive.`;
    }
    note.replaceWith(ov); ov.id = "note";
  }
}

function renderHistory(items){
  const box = document.getElementById("history");
  box.innerHTML = "";
  (items || []).forEach(it=>{
    const row = document.createElement("div"); row.className="hist-item";
    const dot = document.createElement("div"); dot.className="dot " + (it.overall||"none");
    if (it.overall==="green") dot.className="dot green";
    if (it.overall==="yellow") dot.className="dot yellow";
    if (it.overall==="red") dot.className="dot red";
    const link = document.createElement("a");
    link.className="link"; link.href=it.url; link.target="_blank";
    link.title = it.title || it.url;
    link.textContent = (it.title || it.url);
    const small = document.createElement("div");
    const dt = new Date(it.ts||Date.now());
    small.className="small";
    small.textContent = `${dt.toLocaleTimeString()} • ${it.winner||'n/a'}`;
    row.appendChild(dot); row.appendChild(link); row.appendChild(small);
    box.appendChild(row);
  });
}

function getActiveTabId(cb){
  chrome.tabs.query({active:true, currentWindow:true}, (tabs)=> cb(tabs?.[0]?.id));
}

function refresh(){
  getActiveTabId(async (tabId)=>{
    const key = `cyberbuddy_tab_${tabId}`;
    const store = await chrome.storage.local.get([key, "cyberbuddy_history","cyberbuddy_last_scan"]);
    render(store[key]);
    renderHistory(store["cyberbuddy_history"] || []);
    const btn = document.getElementById("scan");
    if (!scanning) btn.querySelector("#scantext").textContent = store["cyberbuddy_last_scan"] ? "Scan again" : "Scan this page";
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("scan").addEventListener("click", ()=>{
    if (scanning) return;
    // show what we’re about to scan (best-effort from last meta)
    getActiveTabId(async (tabId)=>{
      const key = `cyberbuddy_tab_${tabId}`;
      const store = await chrome.storage.local.get([key]);
      setScanningUI(true, store[key]?.meta);
    });
    chrome.tabs.query({active:true, currentWindow:true}, (tabs)=>{
      if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, "scan_page");
    });
    setTimeout(refresh, 800);
    setTimeout(()=>{ refresh(); setScanningUI(false); }, 1800);
    setTimeout(()=>{ if (scanning) setScanningUI(false); }, 5000);
  });

  chrome.runtime.onMessage.addListener(async (msg)=>{
    if (!msg || msg.type !== "scan_status") return;
    if (msg.status === "started") {
      getActiveTabId(async (tabId)=>{
        const key = `cyberbuddy_tab_${tabId}`;
        const store = await chrome.storage.local.get([key]);
        setScanningUI(true, store[key]?.meta);
      });
    }
    if (msg.status === "done") { setScanningUI(false); refresh(); }
  });

  refresh();
});