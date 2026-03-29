;(function () {
  if (window.__SAT__) { window.__SAT__.toggle(); return }

  let laserOn=false, drawing=false, trail=[], raf=null
  let recOn=false, recSecs=0, recTimer=null, recorder=null, chunks=[]
  let camOn=false, camStream=null, camShape="rounded"
  let laserColor="#FF3B30", laserW=5
  let shown=true, cpShown=false, spShown=false
  let micOn=false, micStream=null

  const COLORS=["#FF3B30","#FF9500","#FFD600","#34C759","#007AFF","#5856D6","#fff","#111"]
  const SHAPES=[{id:"rounded",label:"圆角"},{id:"circle",label:"圆形"},{id:"square",label:"方形"}]

  // ── 激光 canvas ──
  const lc=document.createElement("canvas")
  lc.style.cssText="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;"
  lc.width=innerWidth; lc.height=innerHeight
  document.body.append(lc)
  const lx=lc.getContext("2d")

  // ── 摄像气泡 ──
  const bubble=document.createElement("div")
  bubble.style.cssText="position:fixed;right:24px;top:80px;width:200px;height:150px;border-radius:20px;overflow:hidden;box-shadow:0 0 0 3px #fff,0 8px 32px rgba(0,0,0,.4);cursor:grab;z-index:2147483644;background:#000;display:none;pointer-events:all;"
  const vid=document.createElement("video")
  vid.autoplay=vid.muted=vid.playsInline=true
  vid.style.cssText="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block;pointer-events:none;"
  const rh=document.createElement("div")
  rh.style.cssText="position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:se-resize;z-index:10;"
  bubble.append(vid,rh)
  document.body.append(bubble)

  let camPos={x:window.innerWidth-228,y:80}, camSize={w:200,h:150}
  let isDragging=false, isResizing=false, dragOffset={x:0,y:0}, resizeStart={}

  function applyShape(){
    const r={rounded:"20px",circle:"50%",square:"6px"}[camShape]||"20px"
    bubble.style.borderRadius=r
  }
  function updateBubble(){
    bubble.style.left=camPos.x+"px"; bubble.style.top=camPos.y+"px"
    bubble.style.right="auto"; bubble.style.bottom="auto"
    bubble.style.width=camSize.w+"px"; bubble.style.height=camSize.h+"px"
    applyShape()
  }
  bubble.addEventListener("mousedown",e=>{
    if(e.target===rh) return
    // 从 DOM 实际位置同步，防止 camPos 与实际渲染位置不一致
    const r=bubble.getBoundingClientRect()
    camPos={x:r.left, y:r.top}
    isDragging=true; dragOffset={x:e.clientX-r.left, y:e.clientY-r.top}
    bubble.style.cursor="grabbing"; e.preventDefault()
  })
  rh.addEventListener("mousedown",e=>{
    const r=bubble.getBoundingClientRect()
    camPos={x:r.left, y:r.top}; camSize={w:r.width, h:r.height}
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
  window.addEventListener("mouseup",()=>{ isDragging=false; isResizing=false; bubble.style.cursor="grab" })
  bubble.addEventListener("wheel",e=>{
    e.preventDefault(); const f=e.deltaY<0?1.1:0.9
    camSize={w:Math.max(80,Math.min(700,Math.round(camSize.w*f))),h:Math.max(60,Math.min(600,Math.round(camSize.h*f)))}
    updateBubble()
  },{passive:false})

  // ── 工具栏 ──
  const bar=document.createElement("div")
  bar.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(12,12,12,.93);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.1);border-radius:30px;padding:6px 10px;display:flex;align-items:center;gap:2px;box-shadow:0 2px 0 1px rgba(0,0,0,.5),0 16px 48px rgba(0,0,0,.6);z-index:2147483647;pointer-events:all;font-family:-apple-system,sans-serif;user-select:none;cursor:grab;"
  document.body.append(bar)

  // 工具栏位置状态
  let barAnchored = "bottom"
  let barDrag = false, barOff = {x:0, y:0}

  // 初始化为像素坐标（消除 transform）
  requestAnimationFrame(()=>{
    const r = bar.getBoundingClientRect()
    bar.style.left = r.left + "px"
    bar.style.top  = r.top  + "px"
    bar.style.bottom = "auto"
    bar.style.transform = "none"
  })

  bar.addEventListener("mousedown", e=>{
    if (e.target.closest("button") || e.target.closest("input")) return
    // 每次拖动前从 DOM 取当前真实位置
    const r = bar.getBoundingClientRect()
    bar.style.left = r.left + "px"
    bar.style.top  = r.top  + "px"
    bar.style.bottom = "auto"
    bar.style.transform = "none"
    bar.style.transition = "none" // 拖动时禁止任何过渡
    barOff = { x: e.clientX - r.left, y: e.clientY - r.top }
    barDrag = true
    bar.style.cursor = "grabbing"
    e.preventDefault()
  })
  window.addEventListener("mousemove", e=>{
    if (!barDrag) return
    // 直接设置，不做任何处理，完全跟手
    bar.style.left = (e.clientX - barOff.x) + "px"
    bar.style.top  = (e.clientY - barOff.y) + "px"
  })
  window.addEventListener("mouseup", ()=>{
    if (!barDrag) return
    barDrag = false
    bar.style.cursor = "grab"
    bar.style.transition = "" // 恢复默认
    // 松手停在原地，记录上下位置供收起用
    const r = bar.getBoundingClientRect()
    barAnchored = (r.top + r.height / 2) < window.innerHeight / 2 ? "top" : "bottom"
  })

  // ── 收起条 ──
  const colBar=document.createElement("div")
  colBar.style.cssText="position:fixed;left:50%;transform:translateX(-50%);background:rgba(12,12,12,.93);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:5px 18px;display:none;align-items:center;gap:6px;z-index:2147483647;pointer-events:all;cursor:pointer;font-family:-apple-system,sans-serif;"
  colBar.innerHTML=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.5" stroke-linecap="round" id="colArrow"><path d="M6 9l6 6 6-6"/></svg><span style="font-size:11px;color:rgba(255,255,255,.3);">ShowAndTell</span>`
  document.body.append(colBar)

  function snapColBar(){
    // 收起条跟工具栏同侧
    if(barAnchored==="top"){
      colBar.style.top="16px"; colBar.style.bottom="auto"
      colBar.querySelector("#colArrow").querySelector("path").setAttribute("d","M6 15l6-6 6 6") // 箭头朝上
    } else {
      colBar.style.bottom="16px"; colBar.style.top="auto"
      colBar.querySelector("#colArrow").querySelector("path").setAttribute("d","M6 9l6 6 6-6") // 箭头朝下
    }
    // 水平位置跟随工具栏
    const r=bar.getBoundingClientRect()
    const cx=barX+r.width/2
    colBar.style.left=cx+"px"
  }

  colBar.onclick=()=>{
    colBar.style.display="none"
    // 回到底部居中原位
    bar.style.left="50%"; bar.style.top="auto"
    bar.style.bottom="24px"; bar.style.transform="translateX(-50%)"
    bar.style.display="flex"
    bar.style.opacity="0"
    bar.style.transition="opacity .2s"
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      bar.style.opacity="1"
      setTimeout(()=>bar.style.transition="",220)
    }))
    barAnchored="bottom"
  }

  // ── 按钮工厂 ──
  function mkBtn(inner, tip){
    const b=document.createElement("button"); b.title=tip
    b.style.cssText="border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:7px;height:38px;padding:0 12px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;letter-spacing:.2px;transition:background .15s,outline .15s;flex-shrink:0;font-family:-apple-system,sans-serif;"
    b.innerHTML=inner
    b.onmouseenter=()=>{ if(!b._on) b.style.background="rgba(255,255,255,.09)" }
    b.onmouseleave=()=>{ if(!b._on) b.style.background="transparent" }
    return b
  }
  function setOn(b,on){
    b._on=on
    b.style.background=on?"rgba(255,214,0,.18)":"transparent"
    b.style.outline=on?"1.5px solid rgba(255,214,0,.55)":"none"
  }
  function sep(){ const d=document.createElement("div"); d.style.cssText="width:1px;height:20px;background:rgba(255,255,255,.08);margin:0 3px;flex-shrink:0;"; return d }

  const TW="https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/svg"
  const img=(code,size=20)=>`<img src="${TW}/${code}.svg" width="${size}" height="${size}" style="display:block;flex-shrink:0;">`

  // ── 按钮 ──
  const bCam   = mkBtn(img("1f4f7")+"摄像头", "摄像头 C")
  const bShape = mkBtn("···", "摄像框形状")
  bShape.style.padding="0 8px"; bShape.style.fontSize="16px"; bShape.style.letterSpacing="1px"

  const bMic = mkBtn(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.8" stroke-linecap="round"><rect id="micRect" x="9" y="2" width="6" height="11" rx="3" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.4)"/><path d="M5 11a7 7 0 0014 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>`, "麦克风")
  bMic.style.padding="0 8px"; bMic.style.width="36px"

  const bMouse = mkBtn(img("1f5b1",18)+"鼠标", "鼠标 M")
  const bLaser = mkBtn(img("1f526")+"激光笔", "激光笔 L")
  const bColor = mkBtn(img("1f3a8")+"颜色", "颜色")

  const bRec = document.createElement("button")
  bRec.style.cssText="border:none;background:rgba(255,59,48,.15);cursor:pointer;display:flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:12px;font-size:13px;font-weight:600;color:#fff;transition:all .15s;flex-shrink:0;font-family:-apple-system,sans-serif;"
  bRec.innerHTML=img("1f534",18)+"录制"
  bRec.onmouseenter=()=>{ if(!bRec._rec) bRec.style.background="rgba(255,59,48,.28)" }
  bRec.onmouseleave=()=>{ if(!bRec._rec) bRec.style.background="rgba(255,59,48,.15)" }

  const timerEl=document.createElement("div")
  timerEl.style.cssText="font-size:12px;font-weight:700;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums;letter-spacing:.5px;min-width:32px;text-align:center;"
  timerEl.textContent="00:00"

  const bToggle = mkBtn(`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>`, "收起")
  bToggle.style.padding="0 8px"; bToggle.style.width="32px"

  const bClose = mkBtn(`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`, "关闭 Esc")
  bClose.style.padding="0 8px"; bClose.style.width="36px"

  bar.append(bCam, bShape, bMic, sep(), bMouse, bLaser, bColor, sep(), bRec, timerEl, sep(), bToggle, bClose)
  setOn(bMouse, true)

  // ── 收起/展开 ──
  bToggle.onclick=()=>{
    // 收起时：吸到最近边，然后滑出
    const r = bar.getBoundingClientRect()
    const isTop = barAnchored === "top"
    // 先把 bar 吸到对应边（无动画）
    if (isTop) {
      bar.style.top = "16px"; bar.style.bottom = "auto"
    } else {
      bar.style.top = (window.innerHeight - r.height - 16) + "px"; bar.style.bottom = "auto"
    }
    // 再滑出
    bar.style.transition = "transform .2s ease, opacity .18s"
    requestAnimationFrame(()=>{
      bar.style.transform = isTop ? "translateY(-120%)" : "translateY(120%)"
      bar.style.opacity = "0"
    })
    setTimeout(()=>{
      bar.style.display = "none"
      bar.style.transform = "none"; bar.style.opacity = ""
      bar.style.transition = ""
      // 收起条位置
      snapColBar()
      colBar.style.display = "flex"
    }, 210)
  }

  // ── 颜色面板 ──
  const cpanel=document.createElement("div")
  cpanel.style.cssText="position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:rgba(14,14,14,.97);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:12px;display:none;flex-wrap:wrap;gap:8px;width:196px;box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:2147483647;pointer-events:all;"
  document.body.append(cpanel)
  COLORS.forEach(c=>{
    const s=document.createElement("div")
    s.style.cssText=`width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2.5px solid ${c===laserColor?"#fff":"transparent"};transition:all .15s;`
    s.onmouseenter=()=>s.style.transform="scale(1.2)"
    s.onmouseleave=()=>s.style.transform="scale(1)"
    s.onclick=()=>{ laserColor=c; cpanel.querySelectorAll("div").forEach(d=>d.style.borderColor="transparent"); s.style.borderColor="#fff"; hideCp() }
    cpanel.append(s)
  })
  const swRow=document.createElement("div"); swRow.style.cssText="width:100%;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);"
  const swHead=document.createElement("div"); swHead.style.cssText="display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px;"
  const swLbl=document.createElement("span"); swLbl.style.color="rgba(255,255,255,.4)"; swLbl.textContent="粗细"
  const swVal=document.createElement("span"); swVal.style.cssText="color:#fff;font-weight:600;"; swVal.textContent=laserW+"px"
  swHead.append(swLbl,swVal)
  const swIn=document.createElement("input"); swIn.type="range";swIn.min=2;swIn.max=14;swIn.value=laserW;swIn.style.cssText="width:100%;accent-color:#FFD600;"
  swIn.oninput=()=>{ laserW=+swIn.value; swVal.textContent=laserW+"px" }
  swRow.append(swHead,swIn); cpanel.append(swRow)
  function hideCp(){ cpShown=false; cpanel.style.display="none" }

  // ── 形状菜单 ──
  const shapePop=document.createElement("div")
  shapePop.style.cssText="position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:rgba(14,14,14,.97);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:8px;display:none;flex-direction:column;gap:4px;box-shadow:0 16px 48px rgba(0,0,0,.7);z-index:2147483647;pointer-events:all;min-width:110px;"
  document.body.append(shapePop)
  SHAPES.forEach(s=>{
    const b=document.createElement("button")
    b.textContent=s.label
    b.style.cssText="border:none;background:transparent;cursor:pointer;display:flex;align-items:center;height:34px;padding:0 12px;border-radius:8px;font-size:13px;font-weight:600;color:#fff;font-family:-apple-system,sans-serif;width:100%;"
    if(s.id===camShape) b.style.cssText+=";background:rgba(255,214,0,.18);color:#FFD600;"
    b.onclick=()=>{
      camShape=s.id; applyShape()
      shapePop.querySelectorAll("button").forEach(x=>{ x.style.background="transparent"; x.style.color="#fff" })
      b.style.background="rgba(255,214,0,.18)"; b.style.color="#FFD600"
      hideSp()
    }
    shapePop.append(b)
  })
  function hideSp(){ spShown=false; shapePop.style.display="none" }

  // ── 激光笔 ──
  function setLaser(on){
    laserOn=on; setOn(bLaser,on); setOn(bMouse,!on)
    lc.style.pointerEvents=on?"all":"none"
    lc.style.cursor=on?"crosshair":"default"
    if(on) startLaserRaf(); else stopLaserRaf()
  }
  lc.addEventListener("mousedown",e=>{ drawing=true; trail=[{x:e.clientX,y:e.clientY,t:Date.now()}] })
  lc.addEventListener("mousemove",e=>{ if(drawing) trail.push({x:e.clientX,y:e.clientY,t:Date.now()}) })
  lc.addEventListener("mouseup",()=>drawing=false)
  lc.addEventListener("mouseleave",()=>drawing=false)
  function startLaserRaf(){
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
  function stopLaserRaf(){ if(raf){cancelAnimationFrame(raf);raf=null}; lx.clearRect(0,0,lc.width,lc.height); trail=[] }

  // ── 摄像头 ──
  async function startCam(){
    try{
      camStream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false})
      vid.srcObject=camStream; updateBubble(); bubble.style.display="block"
      camOn=true; setOn(bCam,true)
    }catch(e){ alert("摄像头失败："+e.message) }
  }
  function stopCam(){
    if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}
    bubble.style.display="none"; camOn=false; setOn(bCam,false)
  }

  // ── 麦克风 ──
  async function toggleMic(){
    const svg=bMic.querySelector("svg")
    if(micOn){
      if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null}
      micOn=false; setOn(bMic,false)
      svg.style.opacity=".4"
    } else {
      try{
        micStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
        micOn=true; setOn(bMic,true); svg.style.opacity="1"
      }catch(e){ alert("麦克风失败："+e.message) }
    }
  }

  // ── 录制 ──
  function fmt(s){return`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`}
  async function startRec(){
    try{
      const ss=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true})
      let ms=null; try{ms=await navigator.mediaDevices.getUserMedia({audio:true,video:false})}catch{}
      const tracks=[...ss.getTracks()]; if(ms)tracks.push(...ms.getAudioTracks())
      chunks=[]; recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:"video/webm;codecs=vp9"})
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)}
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:"video/webm"})
        ss.getTracks().forEach(t=>t.stop()); if(ms)ms.getTracks().forEach(t=>t.stop())
        exportPanel(blob)
      }
      recorder.start(); recOn=true; recSecs=0; timerEl.textContent="00:00"
      bRec.innerHTML=img("23f9",18)+"停止"; bRec._rec=true; bRec.style.background="rgba(255,59,48,.9)"
      timerEl.style.color="#FF3B30"
      recTimer=setInterval(()=>{recSecs++;timerEl.textContent=fmt(recSecs)},1000)
      ss.getVideoTracks()[0].onended=stopRec
    }catch(e){console.error(e)}
  }
  function stopRec(){
    if(!recOn)return; recOn=false; clearInterval(recTimer)
    if(recorder?.state!=="inactive")recorder.stop()
    bRec.innerHTML=img("1f534",18)+"录制"; bRec._rec=false; bRec.style.background="rgba(255,59,48,.15)"
    timerEl.style.color="rgba(255,255,255,.7)"; timerEl.textContent="00:00"
  }
  function exportPanel(blob){
    const p=document.createElement("div")
    p.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(12,12,12,.97);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:32px;width:300px;box-shadow:0 30px 80px rgba(0,0,0,.8);z-index:2147483647;pointer-events:all;font-family:-apple-system,sans-serif;color:#fff;"
    p.innerHTML=`<div style="font-size:20px;font-weight:700;margin-bottom:4px;">录制完成</div><div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:24px;">${fmt(recSecs)} · ${(blob.size/1024/1024).toFixed(1)} MB</div><button id="sat-dl" style="width:100%;height:48px;border-radius:14px;border:none;background:#FFD600;color:#111;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">下载录制文件</button><button id="sat-cls" style="width:100%;height:36px;border-radius:12px;border:none;background:transparent;color:rgba(255,255,255,.25);font-size:13px;cursor:pointer;">关闭</button>`
    document.body.append(p)
    p.querySelector("#sat-dl").onclick=()=>{
      const u=URL.createObjectURL(blob),a=document.createElement("a")
      a.href=u;a.download=`showandtell-${Date.now()}.webm`;document.body.append(a);a.click();a.remove()
      setTimeout(()=>URL.revokeObjectURL(u),3e3); p.remove()
    }
    p.querySelector("#sat-cls").onclick=()=>p.remove()
  }

  // ── 显示/隐藏 ──
  function showAll(){ shown=true; bar.style.display="flex"; if(camOn)bubble.style.display="block" }
  function hideAll(){ shown=false; bar.style.display="none"; colBar.style.display="none"; bubble.style.display="none"; setLaser(false); stopCam(); if(recOn)stopRec(); hideCp(); hideSp() }

  // ── 事件绑定 ──
  bCam.onclick   = ()=> camOn?stopCam():startCam()
  bShape.onclick = e=>{ e.stopPropagation(); spShown=!spShown; shapePop.style.display=spShown?"flex":"none" }
  bMic.onclick   = ()=> toggleMic()
  bMouse.onclick = ()=> setLaser(false)
  bLaser.onclick = ()=> setLaser(!laserOn)
  bColor.onclick = e=>{ e.stopPropagation(); cpShown=!cpShown; cpanel.style.display=cpShown?"flex":"none" }
  bRec.onclick   = ()=> recOn?stopRec():startRec()
  bClose.onclick = ()=> hideAll()

  document.addEventListener("click",e=>{
    if(!cpanel.contains(e.target)&&e.target!==bColor) hideCp()
    if(!shapePop.contains(e.target)&&e.target!==bShape) hideSp()
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
