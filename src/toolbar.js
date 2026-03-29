
const COLORS = ["#FF3B30","#FF9500","#FFD600","#34C759","#007AFF","#5856D6","#fff","#222"]
const SHAPES = [{id:"rounded",label:"圆角"},{id:"circle",label:"圆形"},{id:"square",label:"方形"}]
let laserColor="#FF3B30", laserW=5
let camOn=false, camStream=null, camShape="rounded"
let recOn=false, recSecs=0, recTimer=null, recorder=null, chunks=[], lastBlob=null
let cpShown=false, spShown=false
let micOn=false, micStream=null

// ── 工具栏拖动 ──
const shell = document.getElementById("shell")
let shellDrag=false, shellOff={x:0,y:0}, shellPos={x:null,y:null}
shell.addEventListener("mousedown", e=>{
  if(e.target.closest("button")||e.target.closest("input")) return
  shellDrag=true
  const r=shell.getBoundingClientRect()
  shellOff={x:e.clientX-r.left, y:e.clientY-r.top}
  shell.classList.add("grabbing"); e.preventDefault()
})
window.addEventListener("mousemove",e=>{
  if(!shellDrag) return
  shellPos={x:e.clientX-shellOff.x, y:e.clientY-shellOff.y}
  shell.style.left=shellPos.x+"px"; shell.style.top=shellPos.y+"px"
  shell.style.transform="none"
})
window.addEventListener("mouseup",()=>{ shellDrag=false; shell.classList.remove("grabbing") })

// ── 收起/展开 ──
const bar=document.getElementById("bar"), colBar=document.getElementById("collapseBar")
let collapsed=false
document.getElementById("bToggle").onclick=()=>{
  collapsed=true; bar.style.display="none"; colBar.style.display="flex"
  // 窗口缩小
  chrome.windows?.getCurrent(w=>chrome.windows?.update(w.id,{height:36}))
}
colBar.onclick=()=>{
  collapsed=false; bar.style.display="flex"; colBar.style.display="none"
  chrome.windows?.getCurrent(w=>chrome.windows?.update(w.id,{height:58}))
}

// ── 颜色面板 ──
const cpanel=document.getElementById("cpanel")
COLORS.forEach(c=>{
  const s=document.createElement("div"); s.className="cswatch"+(c===laserColor?" sel":"")
  s.style.background=c
  s.onclick=()=>{
    laserColor=c
    cpanel.querySelectorAll(".cswatch").forEach(d=>d.classList.remove("sel")); s.classList.add("sel")
    sendToTab({type:"setColor",color:c,width:laserW}); hideCp()
  }; cpanel.append(s)
})
const sw=document.createElement("div"); sw.className="sw-row"
const sh=document.createElement("div"); sh.className="sw-head"
const sl=document.createElement("span"); sl.className="sw-lbl"; sl.textContent="粗细"
const sv=document.createElement("span"); sv.className="sw-val"; sv.textContent=laserW+"px"
sh.append(sl,sv)
const si=document.createElement("input"); si.type="range";si.min=2;si.max=14;si.value=laserW
si.oninput=()=>{ laserW=+si.value; sv.textContent=laserW+"px"; sendToTab({type:"setColor",color:laserColor,width:laserW}) }
sw.append(sh,si); cpanel.append(sw)
function hideCp(){ cpShown=false; cpanel.style.display="none" }

// ── 形状菜单 ──
const shapePop=document.getElementById("shapePop")
SHAPES.forEach(s=>{
  const b=document.createElement("button")
  b.textContent=s.label; if(s.id===camShape)b.classList.add("sel")
  b.onclick=()=>{
    camShape=s.id
    shapePop.querySelectorAll("button").forEach(x=>x.classList.remove("sel")); b.classList.add("sel")
    applyShape(); hideSp()
  }; shapePop.append(b)
})
function hideSp(){ spShown=false; shapePop.style.display="none" }
function applyShape(){
  const r={rounded:"20px",circle:"50%",square:"6px"}[camShape]||"20px"
  bub.style.borderRadius=r
}
document.getElementById("bShape").onclick=e=>{
  e.stopPropagation(); spShown=!spShown
  shapePop.style.display=spShown?"flex":"none"
  // 定位到摄像头按钮下方
  const br=document.getElementById("bCam").getBoundingClientRect()
  shapePop.style.left=br.left+"px"; shapePop.style.top=(br.bottom+8)+"px"
  shapePop.style.transform="none"
}

// ── 摄像头拖拽+缩放 ──
const bub=document.getElementById("bubble"), rh=document.getElementById("rh")
let camPos={x:window.innerWidth-228,y:80}, camSize={w:200,h:150}
let isDragging=false, isResizing=false, dragOffset={x:0,y:0}, resizeStart={}

function updateBubble(){
  bub.style.left=camPos.x+"px"; bub.style.top=camPos.y+"px"
  bub.style.right="auto"; bub.style.bottom="auto"
  bub.style.width=camSize.w+"px"; bub.style.height=camSize.h+"px"
  applyShape()
}
bub.addEventListener("mousedown",e=>{
  if(e.target===rh) return
  isDragging=true; dragOffset={x:e.clientX-camPos.x,y:e.clientY-camPos.y}
  bub.classList.add("grabbing"); e.preventDefault()
})
rh.addEventListener("mousedown",e=>{
  isResizing=true; resizeStart={mx:e.clientX,my:e.clientY,w:camSize.w,h:camSize.h}
  e.stopPropagation(); e.preventDefault()
})
window.addEventListener("mousemove",e=>{
  if(isDragging){ camPos={x:e.clientX-dragOffset.x,y:e.clientY-dragOffset.y}; updateBubble() }
  if(isResizing){
    camSize={w:Math.max(80,Math.min(700,resizeStart.w+(e.clientX-resizeStart.mx))),
             h:Math.max(60,Math.min(600,resizeStart.h+(e.clientY-resizeStart.my)))}
    updateBubble()
  }
})
window.addEventListener("mouseup",()=>{ isDragging=false; isResizing=false; bub.classList.remove("grabbing") })
bub.addEventListener("wheel",e=>{
  e.preventDefault(); const f=e.deltaY<0?1.1:0.9
  camSize={w:Math.max(80,Math.min(700,Math.round(camSize.w*f))),h:Math.max(60,Math.min(600,Math.round(camSize.h*f)))}
  updateBubble()
},{passive:false})

document.getElementById("bCam").onclick=async()=>{ camOn?stopCam():await startCam() }
async function startCam(){
  try{
    camStream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false})
    document.getElementById("vid").srcObject=camStream
    camPos={x:window.innerWidth-228,y:80}; camSize={w:200,h:150}
    updateBubble(); bub.style.display="block"
    camOn=true; setOn(document.getElementById("bCam"),true)
  }catch(e){ alert("摄像头失败："+e.message) }
}
function stopCam(){
  if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}
  bub.style.display="none"; camOn=false; setOn(document.getElementById("bCam"),false)
}

// ── 麦克风 ──
document.getElementById("bMic").onclick=async()=>{
  const btn=document.getElementById("bMic")
  if(micOn){
    if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null}
    micOn=false; btn.classList.remove("on")
    btn.querySelector("rect").style.fill="rgba(255,255,255,.25)"
    btn.querySelectorAll("path,line").forEach(el=>el.style.stroke="rgba(255,255,255,.4)")
  } else {
    try{
      micStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
      micOn=true; btn.classList.add("on")
      btn.querySelector("rect").style.fill="#fff"
      btn.querySelectorAll("path,line").forEach(el=>el.style.stroke="#fff")
    }catch(e){ alert("麦克风失败："+e.message) }
  }
}

// ── 激光/鼠标 ──
document.getElementById("bMouse").onclick=()=>{
  setOn(document.getElementById("bMouse"),true); setOn(document.getElementById("bLaser"),false)
  sendToTab({type:"setLaser",on:false})
}
document.getElementById("bLaser").onclick=()=>{
  setOn(document.getElementById("bLaser"),true); setOn(document.getElementById("bMouse"),false)
  sendToTab({type:"setLaser",on:true,color:laserColor,width:laserW})
}
document.getElementById("bColor").onclick=e=>{
  e.stopPropagation(); cpShown=!cpShown; cpanel.style.display=cpShown?"flex":"none"
}

// ── 录制 ──
document.getElementById("bRec").onclick=()=>recOn?stopRec():startRec()
async function startRec(){
  try{
    const ss=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true})
    let ms=null; try{ms=await navigator.mediaDevices.getUserMedia({audio:true,video:false})}catch{}
    const tracks=[...ss.getTracks()]; if(ms)tracks.push(...ms.getAudioTracks())
    chunks=[]; recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:"video/webm;codecs=vp9"})
    recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)}
    recorder.onstop=()=>{
      lastBlob=new Blob(chunks,{type:"video/webm"})
      ss.getTracks().forEach(t=>t.stop()); if(ms)ms.getTracks().forEach(t=>t.stop())
      showExport()
    }
    recorder.start(); recOn=true; recSecs=0
    const bRec=document.getElementById("bRec")
    bRec.innerHTML=`<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/23f9.svg" width="18" height="18">停止`
    bRec.classList.add("rec")
    const timer=document.getElementById("timer"); timer.classList.add("active")
    recTimer=setInterval(()=>{recSecs++;timer.textContent=fmt(recSecs)},1000)
    ss.getVideoTracks()[0].onended=stopRec
  }catch(e){console.error(e)}
}
function stopRec(){
  if(!recOn)return; recOn=false; clearInterval(recTimer)
  if(recorder?.state!=="inactive")recorder.stop()
  const bRec=document.getElementById("bRec")
  bRec.innerHTML=`<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f534.svg" width="18" height="18">录制`
  bRec.classList.remove("rec")
  const t=document.getElementById("timer"); t.classList.remove("active"); t.textContent="00:00"
}
function showExport(){
  const ep=document.getElementById("expanel")
  document.getElementById("esub").textContent=`${fmt(recSecs)} · ${(lastBlob.size/1024/1024).toFixed(1)} MB`
  ep.style.display="flex"
  document.getElementById("edl").onclick=()=>{
    const u=URL.createObjectURL(lastBlob),a=document.createElement("a")
    a.href=u;a.download=`showandtell-${Date.now()}.webm`;document.body.append(a);a.click();a.remove()
    setTimeout(()=>URL.revokeObjectURL(u),3e3); ep.style.display="none"
  }
  document.getElementById("ecls").onclick=()=>ep.style.display="none"
}

// ── 关闭 ──
document.getElementById("bClose").onclick=()=>window.close()

// ── 关闭浮层 ──
document.addEventListener("click",e=>{
  if(!cpanel.contains(e.target)&&e.target!==document.getElementById("bColor")) hideCp()
  if(!shapePop.contains(e.target)&&e.target!==document.getElementById("bShape")) hideSp()
})

// ── 工具函数 ──
function fmt(s){return`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`}
function setOn(btn,on){btn.classList.toggle("on",on)}
function sendToTab(msg){
  chrome.tabs?.query({},tabs=>{tabs.forEach(t=>{try{chrome.tabs.sendMessage(t.id,msg)}catch{}})})
}
document.addEventListener("keydown",e=>{
  if(e.key==="l"||e.key==="L") document.getElementById("bLaser").click()
  if(e.key==="m"||e.key==="M") document.getElementById("bMouse").click()
  if(e.key==="c"||e.key==="C") document.getElementById("bCam").click()
  if(e.key==="r"||e.key==="R") document.getElementById("bRec").click()
  if(e.key==="Escape") window.close()
})
