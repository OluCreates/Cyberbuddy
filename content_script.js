// content_script.js â€” fully local analysis in the page context
console.log("[CyberBuddy] content_script loaded");
chrome.runtime.sendMessage({ type: "cb_reset_for_tab" });

// ---------- TEXT ANALYZER (JS, stricter) ----------
const STOP = new Set(("the a an and but or for nor so yet of to in on at by with from as is are was were be been being that which who whom this").split(" "));

function splitSentences(t){ return (t.match(/[^.!?]+/g)||[]).map(s=>s.trim()).filter(Boolean); }
function words(t){ return (t.match(/[A-Za-z']+/g)||[]); }

function analyzeTextJS(text){
  if (!text || text.trim().length < 80) return { verdict:"none", score:0, reason:["no_text_detected"] };
  text = text.replace(/\s+/g," ").trim();

  const sents = splitSentences(text);
  const w = words(text);
  if (!sents.length || !w.length) return { verdict:"none", score:0, reason:["no_text_detected"] };

  const sentLens = sents.map(s => (s.match(/[A-Za-z']+/g)||[]).length);
  const avg = sentLens.reduce((a,b)=>a+b,0)/sentLens.length;
  const stdev = Math.sqrt(sentLens.reduce((a,b)=>a+(b-avg)*(b-avg),0)/sentLens.length);
  const coeffVar = stdev/(avg+1e-6);

  const avgWordLen = w.reduce((a,b)=>a+b.length,0)/w.length;
  const stopRatio = w.reduce((a,b)=>a+(STOP.has(b.toLowerCase())?1:0),0)/(w.length+1e-6);

  const tokens = w.map(x=>x.toLowerCase());
  const grams = [];
  for (let i=0;i<=tokens.length-3;i++) grams.push(tokens.slice(i,i+3).join(" "));
  let repScore = 0;
  if (grams.length){
    const m = new Map(); for (const g of grams){ m.set(g,(m.get(g)||0)+1); }
    repScore = Math.max(...m.values())/grams.length;
  }

  const punctRatio = (text.match(/[,:;()\-\u2013\u2014]/g)||[]).length / Math.max(1,text.length);
  const ttr = (new Set(tokens)).size / Math.max(1,tokens.length);

  const reasons = []; let score = 0;
  if (coeffVar < 0.18 && avg > 17){ reasons.push("uniform_sentence_lengths"); score += 0.32; }
  if (avgWordLen > 5.4 && stopRatio < 0.33){ reasons.push("low_stopword_ratio_high_token_complexity"); score += 0.32; }
  if (repScore > 0.045){ reasons.push("repetitive_phrasing"); score += 0.22; }
  if (punctRatio > 0.012){ reasons.push("heavy_structuring_punctuation"); score += 0.14; }
  if (ttr < 0.38){ reasons.push("low_lexical_diversity"); score += 0.12; }
  if (!/\b(can't|don't|won't|I'm|we're|they're|it's)\b/i.test(text) &&
      !/\b(maybe|kind of|sort of|I think)\b/i.test(text)) {
    reasons.push("overly_formal_register"); score += 0.16;
  }

  const verdict = (score>=0.55) ? "red" : (score>=0.25) ? "yellow" : "green";
  return { verdict, score:Number(score.toFixed(3)), reason:reasons };
}

// ---------- VISUAL ANALYZER (JS, stricter) ----------
function toImageBitmap(dataURL){
  const blob = dataURLToBlob(dataURL);
  return createImageBitmap(blob);
}
function dataURLToBlob(d){
  const parts = d.split(','), base64 = parts[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], {type:"image/jpeg"});
}
function grayImageData(ctx, w, h){
  const im = ctx.getImageData(0,0,w,h).data;
  const g = new Float32Array(w*h);
  for (let i=0,j=0;i<im.length;i+=4, j++){
    g[j] = 0.299*im[i] + 0.587*im[i+1] + 0.114*im[i+2];
  }
  return g;
}
function laplacianVar(gray, w, h){
  const k = [0,1,0, 1,-4,1, 0,1,0];
  let sum=0, sum2=0, n=0;
  for (let y=1;y<h-1;y++){
    for (let x=1;x<w-1;x++){
      const i=y*w+x;
      const v = k[0]*gray[i-w-1] + k[1]*gray[i-w] + k[2]*gray[i-w+1] +
                k[3]*gray[i-1]   + k[4]*gray[i]   + k[5]*gray[i+1] +
                k[6]*gray[i+w-1] + k[7]*gray[i+w] + k[8]*gray[i+w+1];
      sum += v; sum2 += v*v; n++;
    }
  }
  const mean = sum/n; const varr = (sum2/n) - mean*mean;
  return Math.max(0, varr);
}
function histRGB(ctx, w, h){
  const im = ctx.getImageData(0,0,w,h).data;
  const bins = new Float32Array(8*8*8);
  for (let i=0;i<im.length;i+=4){
    const r = im[i]>>5, g = im[i+1]>>5, b = im[i+2]>>5;
    bins[r*64 + g*8 + b] += 1;
  }
  let norm = 0; for (let i=0;i<bins.length;i++) norm += bins[i]*bins[i];
  norm = Math.sqrt(norm)||1;
  for (let i=0;i<bins.length;i++) bins[i] /= norm;
  return bins;
}
function histCorr(a,b){
  // correlation (dot product since already normalized)
  let s=0; for (let i=0;i<a.length;i++) s += a[i]*b[i];
  return s;
}
function blockinessScore(ctx, w, h){
  const im = ctx.getImageData(0,0,w,h).data;
  let acc=0, cnt=0;
  // sample vertical/hor lines every 8 px
  for (let x=8; x<w; x+=8){
    for (let y=1; y<h; y++){
      const i = (y*w + x)*4, j = (y*w + (x-1))*4;
      acc += Math.abs(im[i]-im[j]) + Math.abs(im[i+1]-im[j+1]) + Math.abs(im[i+2]-im[j+2]);
      cnt++;
    }
  }
  for (let y=8; y<h; y+=8){
    for (let x=1; x<w; x++){
      const i = (y*w + x)*4, j = ((y-1)*w + x)*4;
      acc += Math.abs(im[i]-im[j]) + Math.abs(im[i+1]-im[j+1]) + Math.abs(im[i+2]-im[j+2]);
      cnt++;
    }
  }
  return (acc/(cnt||1))/3; // average per channel
}
async function analyzeFramesJS(dataURLs){
  if (!dataURLs || !dataURLs.length) return { verdict:"none", score:0, reason:["no_visual_frames"] };
  const blur=[], hist=[], blocks=[];
  const off = new OffscreenCanvas(640,360);
  const ctx = off.getContext("2d", { willReadFrequently:true });

  for (const d of dataURLs){
    const bmp = await toImageBitmap(d);
    const w = Math.min(640, bmp.width), h = Math.min(360, bmp.height);
    off.width = w; off.height = h;
    ctx.drawImage(bmp,0,0,w,h);
    const g = grayImageData(ctx, w, h);
    blur.push(laplacianVar(g, w, h));
    hist.push(histRGB(ctx, w, h));
    blocks.push(blockinessScore(ctx, w, h));
    bmp.close();
  }
  // hist correlation
  const corrs=[];
  for (let i=1;i<hist.length;i++) corrs.push(histCorr(hist[i-1], hist[i]));
  const blurMean = avg(blur), blockMean = avg(blocks), histCorrMean = corrs.length ? avg(corrs) : 1.0;

  // Optional FaceDetector (if available)
  let faceMax = 0;
  try{
    if ("FaceDetector" in window){
      const fd = new window.FaceDetector({ fastMode:true });
      // use the first frame
      const bmp = await toImageBitmap(dataURLs[0]);
      const c2 = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = c2.getContext("2d");
      cx.drawImage(bmp,0,0);
      const blob = await c2.convertToBlob();
      const imgEl = await createImageBitmap(blob);
      // FaceDetector works on ImageBitmap via a canvas element in page; some builds need HTMLImageElement.
      // If it throws, we'll ignore.
      const faces = await fd.detect(imgEl);
      faceMax = faces?.length || 0;
      imgEl.close(); bmp.close();
    }
  }catch{ /* ignore */ }

  const reasons=[]; let score=0;
  if (faceMax === 0){ reasons.push("no_face_detected"); score+=0.32; }
  if (blurMean < 85){ reasons.push("low_detail_blur"); score+=0.32; }
  else if (blurMean > 1250){ reasons.push("extreme_sharpness"); score+=0.10; }
  if (histCorrMean > 0.987){ reasons.push("very_static_frames"); score+=0.30; }
  else if (histCorrMean < 0.46){ reasons.push("frame_noise_inconsistency"); score+=0.15; }
  if (blockMean > 10.2){ reasons.push("jpeg_blockiness"); score+=0.22; }

  const verdict = (score>=0.55) ? "red" : (score>=0.25) ? "yellow" : "green";
  return { verdict, score:Number(score.toFixed(3)), reason:reasons };
}
function avg(a){ return a.reduce((x,y)=>x+y,0)/Math.max(1,a.length); }

// ---------- CAPTURE ----------
function getVisibleText(){
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node){
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p=node.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
      const s = getComputedStyle(p);
      if (s.visibility==="hidden" || s.display==="none") return NodeFilter.FILTER_REJECT;
      if (["SCRIPT","STYLE","NOSCRIPT","IFRAME","CANVAS","SVG","NAV","ASIDE"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const out=[]; while(walker.nextNode()){ out.push(walker.currentNode.nodeValue.trim()); if (out.join(" ").length>8000) break; }
  return out.join(" ");
}

// Live video sampling (no seeking)
function sampleVideoLive(videoEl, totalMs=5000, samples=5){
  return new Promise(resolve=>{
    const frames=[]; const c=document.createElement("canvas");
    const w=videoEl.videoWidth||640, h=videoEl.videoHeight||360;
    c.width=w; c.height=h; const ctx=c.getContext("2d");
    const interval = Math.max(500, Math.floor(totalMs/Math.max(1,samples)));
    let count=0; const timer=setInterval(()=>{
      try{ ctx.drawImage(videoEl,0,0,w,h); frames.push(c.toDataURL("image/jpeg",0.7)); }catch{}
      if (++count>=samples){ clearInterval(timer); resolve(frames); }
    }, interval);
  });
}
async function captureImages(maxCount=3){
  const imgs=[...document.images].filter(i=>i.naturalWidth>=200 && i.naturalHeight>=200).slice(0,maxCount);
  const frames=[];
  for (const img of imgs){
    try{
      const c=document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight;
      const ctx=c.getContext("2d"); ctx.drawImage(img,0,0); frames.push(c.toDataURL("image/jpeg",0.8));
    }catch{}
  }
  return frames;
}

async function scanPage(){
  // tell background we started (spinner ASAP)
  chrome.runtime.sendMessage({ type: "cb_scan_started" });

  const url = location.href; const title=document.title||"Untitled";
  const text = getVisibleText();

  const videos = [...document.querySelectorAll("video")].filter(v=>v.offsetWidth>200 && v.offsetHeight>120);
  let vframes=[]; if (videos.length){ try{ vframes = await sampleVideoLive(videos[0], 5000, 5); }catch{} }
  let iframes=[]; if (!vframes.length){ try{ iframes = await captureImages(3); }catch{} }

  const audioCount = document.querySelectorAll("audio, video[src]").length;

  const meta = {
    url, title,
    counts: { text_chars:(text||"").length, images: iframes.length, videos: videos.length, audio_tags: audioCount },
    what: videos.length ? "video" : (iframes.length ? "images" : (text.length ? "text" : "page"))
  };

  // analyze locally
  const [textRes, visRes] = [
    (text && text.length>80) ? analyzeTextJS(text) : { verdict:"none", score:0, reason:["no_text_detected"] },
    ((vframes.length || iframes.length) ? await analyzeFramesJS(vframes.length ? vframes : iframes) : { verdict:"none", score:0, reason:["no_visual_frames"] })
  ];

  // combine: red > yellow > green > none
  const rank = v=>({red:3,yellow:2,green:1,none:0}[v]||0);
  const winner = (rank(textRes.verdict) >= rank(visRes.verdict)) ? "text" : "visual";
  const overall = (winner==="text") ? textRes.verdict : visRes.verdict;

  const result = {
    overall, winner,
    modalities: { text: textRes, visual: visRes, audio_present: !!audioCount },
    scanned: {
      hasText: !!text && text.length>80,
      hasVideo: vframes.length>0,
      hasImages: iframes.length>0,
      hasAudio: audioCount>0
    },
    meta: { what: { source_hint: meta.what, counts: meta.counts } }
  };

  chrome.runtime.sendMessage({ type: "analyze_result", result });
}

// Auto-run once page loads some content, and respond to popup button
scanPage();
chrome.runtime.onMessage.addListener((msg)=>{ if (msg === "scan_page") scanPage(); });