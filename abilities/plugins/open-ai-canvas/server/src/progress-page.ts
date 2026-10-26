/**
 * 准备页（自包含 HTML，轮询 /__canvas/progress）
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import { STATE } from "./state.ts";

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function progressPage() {
  const failed = STATE.phase === "failed";
  const title = failed ? "运行时准备失败" : "正在准备 Open AI Canvas";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#fafafa;color:#18181b;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{width:min(560px,calc(100vw - 64px))}
h1{margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em}
.sub{margin:0;color:#a1a1aa;font-size:12.5px;line-height:1.5}
.status{margin:28px 0 0;display:flex;align-items:baseline;justify-content:space-between;
font-size:12px;color:#52525b;gap:16px}
#stage{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{margin:9px 0 0;height:4px;border-radius:999px;background:#ececee;overflow:hidden}
.bar{height:100%;width:0;background:#18181b;transition:width .4s cubic-bezier(.4,0,.2,1)}
.bar.idle{animation:breathe 1.8s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.2}50%{opacity:.65}}
.facts{margin:11px 0 0;display:flex;flex-wrap:wrap;gap:18px;color:#a1a1aa;font-size:12px;
font-variant-numeric:tabular-nums}
.facts span:empty{display:none}
.msg{margin:7px 0 0;color:#52525b;font-size:12px;line-height:1.55;word-break:break-word}
.actions{margin:24px 0 0;display:flex;gap:10px}
.log{margin:32px 0 0;color:#a1a1aa;font:11.5px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace;
max-height:160px;overflow:hidden}
.log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.err{margin:28px 0 0;color:#b91c1c;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace;
white-space:pre-wrap;word-break:break-word}
button{margin:0;padding:8px 18px;border:0;border-radius:8px;background:#18181b;color:#fff;
font:inherit;font-size:13px;cursor:pointer}
button.ghost{background:transparent;color:#71717a;box-shadow:inset 0 0 0 1px #e4e4e7}
button[disabled]{opacity:.45;cursor:default}
@media (prefers-color-scheme:dark){
body{background:#09090b;color:#fafafa}
.track{background:#27272a}.bar{background:#fafafa}
button{background:#fafafa;color:#18181b}
button.ghost{background:transparent;color:#a1a1aa;box-shadow:inset 0 0 0 1px #3f3f46}
.err{color:#f87171}
}
</style>
</head>
<body>
<div class="wrap">
  <h1 id="title">${title}</h1>
  <p class="sub" id="sub">首次启动需要下载运行时载荷，完成后自动打开画布</p>
  <div class="status"><span id="stage">${escapeHtml(STATE.stage)}</span><span id="pct"></span></div>
  <div class="track"><div class="bar${STATE.totalBytes > 0 ? "" : " idle"}" id="bar"></div></div>
  <p class="msg" id="msg">${escapeHtml(STATE.message)}</p>
  <div class="facts">
    <span id="file"></span><span id="bytes"></span><span id="speed"></span>
    <span id="eta"></span><span id="elapsed"></span><span id="retries"></span><span id="host"></span>
  </div>
  <div class="log" id="log"></div>
  <pre class="err" id="err"${failed ? "" : " hidden"}>${escapeHtml(STATE.error ?? "")}</pre>
  <div class="actions"><button id="retry"${failed ? "" : " hidden"}>重试 / Retry</button><button id="copy" class="ghost">复制诊断信息</button></div>
</div>
<script>
const bar=document.getElementById('bar'),pct=document.getElementById('pct'),
stageEl=document.getElementById('stage'),bytesEl=document.getElementById('bytes'),
speedEl=document.getElementById('speed'),etaEl=document.getElementById('eta'),
fileEl=document.getElementById('file'),elapsedEl=document.getElementById('elapsed'),
retriesEl=document.getElementById('retries'),hostEl=document.getElementById('host'),
msgEl=document.getElementById('msg'),subEl=document.getElementById('sub'),
logEl=document.getElementById('log'),errEl=document.getElementById('err'),
titleEl=document.getElementById('title'),retry=document.getElementById('retry'),
copy=document.getElementById('copy');
let last=null;
function fmt(n){if(!n)return '0 B';if(n<1024)return n+' B';
if(n<1048576)return (n/1024).toFixed(0)+' KB';
if(n<1073741824)return (n/1048576).toFixed(1)+' MB';
return (n/1073741824).toFixed(2)+' GB'}
function dur(s){if(!s||s<1)return '';if(s<60)return s+' 秒';
const m=Math.floor(s/60),r=s%60;return r?m+' 分 '+r+' 秒':m+' 分'}
function render(p){
  last=p;
  stageEl.textContent=p.stage||'';
  msgEl.textContent=p.message||'';
  fileEl.textContent=p.fileName||'';
  if(p.totalBytes>0){
    bar.classList.remove('idle');
    bar.style.width=p.percent+'%';
    pct.textContent=Math.round(p.percent)+'%';
    bytesEl.textContent=fmt(p.receivedBytes)+' / '+fmt(p.totalBytes);
  }else{
    // 总长度还不知道时也不能看着像死机：条动起来，右侧给出已收到的字节。
    bar.classList.add('idle');bar.style.width='100%';
    pct.textContent=p.receivedBytes?fmt(p.receivedBytes):'';
    bytesEl.textContent=p.receivedBytes?fmt(p.receivedBytes)+' 已接收':'';
  }
  speedEl.textContent=p.speed>0?fmt(p.speed)+'/s':'';
  etaEl.textContent=p.etaSeconds>0?'剩余约 '+dur(p.etaSeconds):'';
  elapsedEl.textContent=p.elapsedSeconds?'已用 '+dur(p.elapsedSeconds):'';
  retriesEl.textContent=p.attempts>1||p.retries?'尝试 '+p.attempts+' 次 / 重试 '+p.retries+' 次':'';
  hostEl.textContent=p.endpoint?(p.endpoint+(p.source&&p.source!=='直连'?' · '+p.source:'')):'';
  logEl.innerHTML='';
  (p.log||[]).forEach(function(e){const d=document.createElement('div');d.textContent=e.text;logEl.appendChild(d)});
}
async function tick(){
  try{
    const r=await fetch('/__canvas/progress',{cache:'no-store'});
    // 就绪那一刻代理会把所有路径交给上游应用，这里再拿到的是 HTML 而不是进度 JSON：
    // 这本身就是「可以进画布了」的信号，直接跳转，别把人留在进度页上。
    const type=r.headers.get('content-type')||'';
    if(!r.ok||!type.includes('json')){location.replace('/');return}
    const p=await r.json();
    if(p.phase==='ready'){location.replace('/');return}
    render(p);
    if(p.phase==='failed'){
      titleEl.textContent='运行时准备失败';
      errEl.hidden=false;errEl.textContent=p.error||'未知错误';
      retry.hidden=false;retry.disabled=false;
      return;
    }
    retry.hidden=true;
  }catch(e){}
  setTimeout(tick,1000);
}
retry.onclick=async function(){
  retry.disabled=true;
  try{await fetch('/__canvas/retry',{method:'POST'})}catch(e){}
  location.reload();
};
copy.onclick=async function(){
  const text=JSON.stringify(last||{},null,2);
  try{await navigator.clipboard.writeText(text);copy.textContent='已复制'}catch(e){copy.textContent='复制失败'}
  setTimeout(function(){copy.textContent='复制诊断信息'},1600);
};
tick();
</script>
</body>
</html>`;
}
