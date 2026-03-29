;(function () {
  if (window.__SAT__) { window.__SAT__.toggle(); return }

  let laserOn=false, drawing=false, trail=[], raf=null
  let recOn=false, recSecs=0, recTimer=null, recorder=null, chunks=[]
  let camOn=false, camStream=null
  let laserColor="#FF3B30", laserW=5
  let shown=true, cpShown=false

  const COLORS=["#FF3B30","#FF9500","#FFD600","#34C759","#007AFF","#5856D6","#fff","#111"]

  // ── 激光 canvas ───────────────────────────────────────
  const lc=document.createElement("canvas")
  lc.style.cssText="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;"
  lc.width=innerWidth; lc.height=innerHeight
  document.body.append(lc)
  const lx=lc.getContext("2d")

  // ── 摄像气泡 ──────────────────────────────────────────
  const bubble=document.createElement("div")
  bubble.style.cssText="position:fixed;right:28px;bottom:96px;width:200px;height:150px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 3px #fff,0 8px 32px rgba(0,0,0,.4);cursor:grab;z-index:2147483644;background:#000;display:none;pointer-events:all;"
  const vid=document.createElement("video")
  vid.autoplay=vid.muted=vid.playsInline=true
  vid.style.cssText="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block;pointer-events:none;"
  // 形状切换按钮（圆形/圆角/方形）
  const shapeBtn=document.createElement("div")
  shapeBtn.style.cssText="position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55);border-radius:8px;padding:3px 6px;cursor:pointer;z-index:10;display:flex;gap:4px;pointer-events:all;"
  const SHAPES=["circle","rounded","square"]
  const SHAPE_LABELS=["⬤","▢","■"]
  let camShape="rounded"
  SHAPES.forEach((s,i)=>{
    const b=document.createElement("span")
    b.textContent=SHAPE_LABELS[i]
    b.style.cssText=`font-size:11px;color:${s===camShape?"#FFD600":"rgba(255,255,255,.5)"};cursor:pointer;transition:color .15s;`
    b.onclick=e=>{
      e.stopPropagation(); camShape=s
      shapeBtn.querySelectorAll("span").forEach((sp,j)=>sp.style.color=SHAPES[j]===s?"#FFD600":"rgba(255,255,255,.5)")
      applyShape()
    }
    shapeBtn.append(b)
  })

  const rh=document.createElement("div")
  rh.style.cssText="position:absolute;right:4px;bottom:4px;width:14px;height:14px;border-radius:3px;background:#FFD600;cursor:se-resize;z-index:10;box-shadow:0 1px 4px rgba(0,0,0,.4);"
  bubble.append(vid, shapeBtn, rh)
  document.body.append(bubble)

  function applyShape(){
    if(camShape==="circle"){
      const d=Math.min(camSize.w,camSize.h)
      bubble.style.borderRadius="50%"
      bubble.style.width=d+"px"; bubble.style.height=d+"px"
    } else if(camShape==="rounded"){
      bubble.style.borderRadius="20px"
      bubble.style.width=camSize.w+"px"; bubble.style.height=camSize.h+"px"
    } else {
      bubble.style.borderRadius="6px"
      bubble.style.width=camSize.w+"px"; bubble.style.height=camSize.h+"px"
    }
  }

  // 拖动：记录鼠标按下时相对于气泡左上角的偏移
  let camPos={x:window.innerWidth-228, y:window.innerHeight-246}
  let camSize={w:200,h:150}
  let isDragging=false, isResizing=false, dragOffset={x:0,y:0}

  function updateBubble(){
    bubble.style.left=camPos.x+"px"; bubble.style.top=camPos.y+"px"
    bubble.style.right="auto"; bubble.style.bottom="auto"
    applyShape()
  }

  bubble.addEventListener("mousedown",e=>{
    if(e.target===rh||shapeBtn.contains(e.target)) return
    isDragging=true
    // 关键：记录鼠标相对于气泡左上角的偏移，不用 getBoundingClientRect
    dragOffset={x:e.clientX-camPos.x, y:e.clientY-camPos.y}
    bubble.style.cursor="grabbing"
    e.preventDefault()
  })
  rh.addEventListener("mousedown",e=>{
    isResizing=true; e.stopPropagation(); e.preventDefault()
  })
  window.addEventListener("mousemove",e=>{
    if(isDragging){
      camPos={x:e.clientX-dragOffset.x, y:e.clientY-dragOffset.y}
      updateBubble()
    }
    if(isResizing){
      camSize={
        w:Math.max(80,Math.min(600,e.clientX-camPos.x)),
        h:Math.max(60,Math.min(500,e.clientY-camPos.y))
      }
      updateBubble()
    }
  })
  window.addEventListener("mouseup",()=>{ isDragging=false; isResizing=false; bubble.style.cursor="grab" })
  bubble.addEventListener("wheel",e=>{
    e.preventDefault()
    const f=e.deltaY<0?1.1:0.9
    camSize={w:Math.max(80,Math.min(600,Math.round(camSize.w*f))), h:Math.max(60,Math.min(500,Math.round(camSize.h*f)))}
    updateBubble()
  },{passive:false})

  // ── 工具栏 ────────────────────────────────────────────
  const bar=document.createElement("div")
  bar.style.cssText=`
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:rgba(12,12,12,.92);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,.1);border-radius:30px;padding:6px 10px;
    display:flex;align-items:center;gap:2px;
    box-shadow:0 2px 0 1px rgba(0,0,0,.5),0 16px 48px rgba(0,0,0,.6);
    z-index:2147483647;pointer-events:all;font-family:-apple-system,sans-serif;user-select:none;
  `
  document.body.append(bar)

  function mkBtn(svg,tip){
    const b=document.createElement("button"); b.title=tip
    b.style.cssText="width:44px;height:44px;border-radius:14px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s;"
    b.innerHTML=svg
    b.onmouseenter=()=>{ if(!b._on) b.style.background="rgba(255,255,255,.08)" }
    b.onmouseleave=()=>{ if(!b._on) b.style.background="transparent" }
    return b
  }
  function glow(b,on){
    b._on=on
    b.style.background=on?"rgba(255,214,0,.18)":"transparent"
    b.style.outline=on?"1.5px solid rgba(255,214,0,.6)":"none"
  }
  function sep(){ const d=document.createElement("div"); d.style.cssText="width:1px;height:20px;background:rgba(255,255,255,.08);margin:0 4px;flex-shrink:0;"; return d }

  // 文字+图标按钮
  function mkLabelBtn(icon, label, tip) {
    const b = document.createElement("button"); b.title=tip
    b.style.cssText="height:38px;padding:0 14px;border-radius:12px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:7px;flex-shrink:0;transition:background .15s,outline .15s;"
    b.innerHTML=`${icon}<span style="font-size:13px;font-weight:600;color:#fff;letter-spacing:.2px;">${label}</span>`
    b.onmouseenter=()=>{ if(!b._on) b.style.background="rgba(255,255,255,.08)" }
    b.onmouseleave=()=>{ if(!b._on) b.style.background="transparent" }
    return b
  }

  const closeSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`

  // Twemoji CDN — 卡通风格 emoji 图片
  function twemoji(code, size=22) {
    return `<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/${code}.svg" width="${size}" height="${size}" style="display:block;flex-shrink:0;">`
  }
  // 📷 1f4f7  🖱️ 1f5b1  🔦 1f526  🎨 1f3a8  ⏺️ 23fa  ✕ 用SVG
  const bCam   = mkLabelBtn(twemoji("1f4f7"), "摄像头", "摄像头 C")
  const bMouse = mkLabelBtn(twemoji("1f5b1"), "鼠标",   "鼠标模式 M")
  const bLaser = mkLabelBtn(twemoji("1f526"), "激光笔", "激光笔 L")

  // 颜色按钮（文字+色块）
  const bColor = document.createElement("button")
  bColor.title="选择颜色"
  bColor.style.cssText="height:38px;padding:0 12px;border-radius:12px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:7px;flex-shrink:0;transition:background .15s;"
  bColor.innerHTML=`<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f3a8.svg" width="22" height="22" style="display:block;flex-shrink:0;"><span style="font-size:13px;font-weight:600;color:#fff;">颜色</span><div id="sat-cdot" style="width:10px;height:10px;border-radius:50%;background:${laserColor};border:1.5px solid rgba(255,255,255,.5);flex-shrink:0;"></div>`
  bColor.onmouseenter=()=>bColor.style.background="rgba(255,255,255,.08)"
  bColor.onmouseleave=()=>bColor.style.background="transparent"
  const cdot = bColor.querySelector("#sat-cdot")

  // 录制按钮
  const bRec = document.createElement("button")
  bRec.title="录制 R"
  bRec.style.cssText="height:38px;padding:0 14px;border-radius:12px;border:none;background:rgba(255,59,48,.15);cursor:pointer;display:flex;align-items:center;gap:7px;flex-shrink:0;transition:all .15s;"
  bRec.innerHTML=`<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f534.svg" width="20" height="20" style="display:block;flex-shrink:0;"><span style="font-size:13px;font-weight:600;color:#fff;">录制</span>`
  bRec.onmouseenter=()=>{ if(!bRec._rec) bRec.style.background="rgba(255,59,48,.28)" }
  bRec.onmouseleave=()=>{ if(!bRec._rec) bRec.style.background="rgba(255,59,48,.15)" }

  const timerEl = document.createElement("div")
  timerEl.style.cssText="font-size:12px;font-weight:700;color:rgba(255,255,255,.75);font-variant-numeric:tabular-nums;letter-spacing:.5px;min-width:34px;text-align:center;"
  timerEl.textContent="00:00"

  const bClose = mkBtn(closeSvg, "关闭 Esc")

  bar.append(bCam, sep(), bMouse, bLaser, bColor, sep(), bRec, timerEl, sep(), bClose)
  glow(bMouse, true)

  // ── 颜色面板 ──────────────────────────────────────────
  const cpanel=document.createElement("div")
  cpanel.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(14,14,14,.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:12px;display:none;flex-wrap:wrap;gap:8px;width:192px;box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:2147483647;pointer-events:all;"
  document.body.append(cpanel)
  COLORS.forEach(c=>{
    const s=document.createElement("div")
    s.style.cssText=`width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2.5px solid ${c===laserColor?"#fff":"transparent"};box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);transition:all .15s;`
    s.onmouseenter=()=>s.style.transform="scale(1.2)"
    s.onmouseleave=()=>s.style.transform="scale(1)"
    s.onclick=()=>{ laserColor=c; cdot.style.background=c; cpanel.querySelectorAll("div").forEach(d=>d.style.borderColor="transparent"); s.style.borderColor="#fff"; hideCp() }
    cpanel.append(s)
  })
  const sw=document.createElement("div"); sw.style.cssText="width:100%;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);"
  const sh=document.createElement("div"); sh.style.cssText="display:flex;justify-content:space-between;margin-bottom:6px;"
  const sl=document.createElement("span"); sl.style.cssText="font-size:11px;color:rgba(255,255,255,.4);"; sl.textContent="粗细"
  const sv=document.createElement("span"); sv.style.cssText="font-size:11px;color:#fff;font-weight:600;"; sv.textContent=laserW+"px"
  sh.append(sl,sv)
  const si=document.createElement("input"); si.type="range";si.min=2;si.max=14;si.value=laserW;si.style.cssText="width:100%;accent-color:#FFD600;"
  si.oninput=()=>{ laserW=+si.value; sv.textContent=laserW+"px" }
  sw.append(sh,si); cpanel.append(sw)
  function hideCp(){ cpShown=false; cpanel.style.display="none" }

  // ── 激光笔 ────────────────────────────────────────────
  function setLaser(on){
    laserOn=on; glow(bLaser,on); glow(bMouse,!on)
    lc.style.pointerEvents=on?"all":"none"
    lc.style.cursor=on?"crosshair":"default"
    if(on) startLaser(); else stopLaser()
  }

  lc.addEventListener("mousedown",e=>{ drawing=true; trail=[{x:e.clientX,y:e.clientY,t:Date.now()}] })
  lc.addEventListener("mousemove",e=>{ if(drawing) trail.push({x:e.clientX,y:e.clientY,t:Date.now()}) })
  lc.addEventListener("mouseup",  ()=>drawing=false)
  lc.addEventListener("mouseleave",()=>drawing=false)

  function startLaser(){
    if(raf)return
    function frame(){
      const now=Date.now(),F=700
      lx.clearRect(0,0,lc.width,lc.height)
      trail=trail.filter(p=>now-p.t<F)
      for(let i=1;i<trail.length;i++){
        const a=trail[i-1],b=trail[i],al=Math.max(0,1-(now-b.t)/F)
        lx.globalAlpha=al; lx.beginPath(); lx.moveTo(a.x,a.y); lx.lineTo(b.x,b.y)
        lx.strokeStyle=laserColor; lx.lineWidth=laserW*1.5; lx.lineCap="round"; lx.stroke()
      }
      if(trail.length){
        const last=trail[trail.length-1],al=Math.max(0,1-(now-last.t)/F)
        lx.globalAlpha=al; lx.beginPath(); lx.arc(last.x,last.y,laserW*3,0,Math.PI*2)
        lx.fillStyle=laserColor; lx.fill()
      }
      lx.globalAlpha=1; raf=requestAnimationFrame(frame)
    }
    raf=requestAnimationFrame(frame)
  }
  function stopLaser(){ if(raf){cancelAnimationFrame(raf);raf=null}; lx.clearRect(0,0,lc.width,lc.height); trail=[] }

  // ── 摄像头 ────────────────────────────────────────────
  async function startCam(){
    try{
      camStream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false})
      vid.srcObject=camStream
      updateBubble(); applyShape()
      bubble.style.display="block"; camOn=true; glow(bCam,true)
    }catch(e){ alert("摄像头失败："+e.message) }
  }
  function stopCam(){
    if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null }
    bubble.style.display="none"; camOn=false; glow(bCam,false)
  }

  // ── 录制 ──────────────────────────────────────────────
  function fmt(s){ return`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}` }

  async function startRec(){
    try{
      const ss=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true})
      let ms=null; try{ ms=await navigator.mediaDevices.getUserMedia({audio:true,video:false}) }catch{}
      const tracks=[...ss.getTracks()]; if(ms)tracks.push(...ms.getAudioTracks())
      chunks=[]
      recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:"video/webm;codecs=vp9"})
      recorder.ondataavailable=e=>{ if(e.data.size>0)chunks.push(e.data) }
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:"video/webm"})
        ss.getTracks().forEach(t=>t.stop()); if(ms)ms.getTracks().forEach(t=>t.stop())
        exportPanel(blob)
      }
      recorder.start(); recOn=true; recSecs=0; timerEl.textContent="00:00"
      bRec.innerHTML=`<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/23f9.svg" width="20" height="20" style="display:block;flex-shrink:0;"><span style="font-size:13px;font-weight:600;color:#fff;">停止</span>`
      bRec._rec=true; bRec.style.background="rgba(255,59,48,.9)"
      timerEl.style.color="#FF3B30"
      recTimer=setInterval(()=>{ recSecs++; timerEl.textContent=fmt(recSecs) },1000)
      ss.getVideoTracks()[0].onended=stopRec
    }catch(e){ console.error(e) }
  }

  function stopRec(){
    if(!recOn)return; recOn=false; clearInterval(recTimer)
    if(recorder?.state!=="inactive")recorder.stop()
    bRec.innerHTML=`<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg/1f534.svg" width="20" height="20" style="display:block;flex-shrink:0;"><span style="font-size:13px;font-weight:600;color:#fff;">录制</span>`
    bRec._rec=false; bRec.style.background="rgba(255,59,48,.15)"
    timerEl.style.color="rgba(255,255,255,.8)"; timerEl.textContent="00:00"; recSecs=0
  }

  // ── 导出面板 ──────────────────────────────────────────
  function exportPanel(blob){
    const p=document.createElement("div")
    p.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(12,12,12,.97);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:32px;width:320px;box-shadow:0 30px 80px rgba(0,0,0,.8);z-index:2147483647;pointer-events:all;font-family:-apple-system,sans-serif;color:#fff;"
    const mb=(blob.size/1024/1024).toFixed(1)
    const sec=recSecs, dur=fmt(sec)
    p.innerHTML=`
      <div style="font-size:20px;font-weight:700;margin-bottom:4px;">录制完成</div>
      <div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:28px;">${dur} · ${mb} MB</div>
      <button id="edl" style="width:100%;height:50px;border-radius:14px;border:none;background:#FFD600;color:#111;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">下载录制文件</button>
      <button id="ecls" style="width:100%;height:36px;border-radius:12px;border:none;background:transparent;color:rgba(255,255,255,.25);font-size:13px;cursor:pointer;">关闭</button>
    `
    document.body.append(p)
    p.querySelector("#edl").onclick=()=>{
      const u=URL.createObjectURL(blob),a=document.createElement("a")
      a.href=u; a.download=`showandtell-${Date.now()}.webm`
      document.body.append(a); a.click(); a.remove()
      setTimeout(()=>URL.revokeObjectURL(u),3e3)
      p.remove()
    }
    p.querySelector("#ecls").onclick=()=>p.remove()
  }

  // ── 显示/隐藏 ─────────────────────────────────────────
  function showAll(){ shown=true; bar.style.display="flex"; if(camOn)bubble.style.display="block" }
  function hideAll(){ shown=false; bar.style.display="none"; bubble.style.display="none"; lc.style.pointerEvents="none"; setLaser(false); stopCam(); if(recOn)stopRec(); hideCp() }

  // ── 事件 ──────────────────────────────────────────────
  bCam.onclick   = ()=> camOn ? stopCam() : startCam()
  bMouse.onclick = ()=> setLaser(false)
  bLaser.onclick = ()=> setLaser(!laserOn)
  bColor.onclick = e=>{ e.stopPropagation(); cpShown=!cpShown; cpanel.style.display=cpShown?"flex":"none" }
  bRec.onclick   = ()=> recOn ? stopRec() : startRec()
  bClose.onclick = ()=> hideAll()

  document.addEventListener("click",e=>{
    if(!cpanel.contains(e.target)&&!bColor.contains(e.target)) hideCp()
  })
  document.addEventListener("keydown",e=>{
    if(!shown||["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return
    if(e.key==="l"||e.key==="L") setLaser(!laserOn)
    if(e.key==="m"||e.key==="M") setLaser(false)
    if(e.key==="c"||e.key==="C") camOn?stopCam():startCam()
    if(e.key==="r"||e.key==="R") recOn?stopRec():startRec()
    if(e.key==="Escape") hideAll()
  })
  addEventListener("resize",()=>{ lc.width=innerWidth; lc.height=innerHeight })

  window.__SAT__={ toggle:()=> shown?hideAll():showAll() }
  showAll()
})()
