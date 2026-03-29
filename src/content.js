;(function () {
  if (window.__SAT__) { window.__SAT__.toggle(); return }

  // ── 状态 ──────────────────────────────────────────────
  let laserOn=false, drawing=false, trail=[], raf=null
  let recOn=false, recSecs=0, recTimer=null, recorder=null, chunks=[]
  let camOn=false, camStream=null
  let beautyOn=false, bSmooth=30, bWhite=20  // 0-100 同 BeautyFilter.ts
  let bRaf=null, bCanvas=null, bCtx=null
  let laserColor="#FF3B30", laserW=5
  let shown=true, cpShown=false, bpShown=false

  const COLORS=["#FF3B30","#FF9500","#FFD600","#34C759","#007AFF","#5856D6","#fff","#111"]

  // ── 美颜（照搬 BeautyFilter.ts 算法） ─────────────────
  function applySmoothing(data, width, height, strength) {
    const radius = Math.max(1, Math.round(strength * 6))
    const temp = new Uint8ClampedArray(data)
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
      let r=0,g=0,b=0,count=0
      for (let dy=-radius;dy<=radius;dy++) for (let dx=-radius;dx<=radius;dx++) {
        const ny=Math.min(height-1,Math.max(0,y+dy)), nx=Math.min(width-1,Math.max(0,x+dx))
        const idx=(ny*width+nx)*4; r+=temp[idx];g+=temp[idx+1];b+=temp[idx+2];count++
      }
      const i=(y*width+x)*4, blend=strength*0.7
      data[i]  =Math.round(data[i]  *(1-blend)+(r/count)*blend)
      data[i+1]=Math.round(data[i+1]*(1-blend)+(g/count)*blend)
      data[i+2]=Math.round(data[i+2]*(1-blend)+(b/count)*blend)
    }
  }

  function applyWhitening(data, strength) {
    const rB=strength*60, gB=strength*50, bB=strength*40
    for (let i=0;i<data.length;i+=4) {
      data[i]=Math.min(255,data[i]+rB); data[i+1]=Math.min(255,data[i+1]+gB); data[i+2]=Math.min(255,data[i+2]+bB)
    }
  }

  function beautyFrame() {
    if (!beautyOn||!camOn||!bCanvas||!vid||vid.readyState<2) { bRaf=requestAnimationFrame(beautyFrame); return }
    const w=vid.videoWidth, h=vid.videoHeight
    if (!w||!h) { bRaf=requestAnimationFrame(beautyFrame); return }
    bCanvas.width=w; bCanvas.height=h
    bCtx.save(); bCtx.translate(w,0); bCtx.scale(-1,1); bCtx.drawImage(vid,0,0,w,h); bCtx.restore()
    if (bSmooth>0||bWhite>0) {
      const id=bCtx.getImageData(0,0,w,h)
      if (bSmooth>0) applySmoothing(id.data,w,h,bSmooth/100)
      if (bWhite>0)  applyWhitening(id.data,bWhite/100)
      bCtx.putImageData(id,0,0)
    }
    bRaf=requestAnimationFrame(beautyFrame)
  }
  function stopBRaf(){if(bRaf){cancelAnimationFrame(bRaf);bRaf=null}}

  // ── 激光 canvas ────────────────────────────────────────
  const lc=document.createElement("canvas")
  lc.style.cssText="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;"
  lc.width=innerWidth;lc.height=innerHeight
  document.body.append(lc)
  const lx=lc.getContext("2d")

  // ── 摄像气泡（照搬 CameraBubble.tsx 拖动逻辑） ─────────
  const bubble=document.createElement("div")
  bubble.style.cssText="position:fixed;right:28px;bottom:96px;width:200px;height:150px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 3px #fff,0 8px 32px rgba(0,0,0,.4);cursor:grab;z-index:2147483644;background:#000;display:none;pointer-events:all;"
  const vid=document.createElement("video")
  vid.autoplay=vid.muted=vid.playsInline=true
  vid.style.cssText="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block;pointer-events:none;"
  // 美颜 canvas（叠在 video 上）
  bCanvas=document.createElement("canvas")
  bCanvas.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;display:none;pointer-events:none;"
  bCtx=bCanvas.getContext("2d")
  // resize handle（右下角）
  const rh=document.createElement("div")
  rh.style.cssText="position:absolute;right:4px;bottom:4px;width:14px;height:14px;border-radius:3px;background:#FFD600;cursor:se-resize;z-index:5;box-shadow:0 1px 4px rgba(0,0,0,.4);"
  bubble.append(vid,bCanvas,rh)
  document.body.append(bubble)

  // 拖动逻辑：完全照搬 CameraBubble.tsx
  let camPos={x:window.innerWidth-228,y:window.innerHeight-246}
  let camSize={w:200,h:150}
  let isDragging=false, isResizing=false
  let dragOffset={x:0,y:0}
  const MIN_W=80,MIN_H=60,MAX_W=600,MAX_H=500

  function updateBubble(){
    bubble.style.left=camPos.x+"px"; bubble.style.top=camPos.y+"px"
    bubble.style.right="auto";       bubble.style.bottom="auto"
    bubble.style.width=camSize.w+"px"; bubble.style.height=camSize.h+"px"
  }

  bubble.addEventListener("mousedown",e=>{
    if(e.target===rh){
      isResizing=true
      e.stopPropagation()
    } else {
      isDragging=true
      dragOffset={x:e.clientX-camPos.x, y:e.clientY-camPos.y}
      bubble.style.cursor="grabbing"
    }
    e.preventDefault()
  })

  window.addEventListener("mousemove",e=>{
    if(isDragging){
      camPos={x:e.clientX-dragOffset.x, y:e.clientY-dragOffset.y}
      updateBubble()
    }
    if(isResizing){
      camSize={
        w:Math.max(MIN_W,Math.min(MAX_W,e.clientX-camPos.x)),
        h:Math.max(MIN_H,Math.min(MAX_H,e.clientY-camPos.y))
      }
      updateBubble()
    }
  })

  window.addEventListener("mouseup",()=>{
    isDragging=false; isResizing=false; bubble.style.cursor="grab"
  })

  // 滚轮缩放（等比）
  bubble.addEventListener("wheel",e=>{
    e.preventDefault()
    const f=e.deltaY<0?1.1:0.9
    camSize={w:Math.max(MIN_W,Math.min(MAX_W,Math.round(camSize.w*f))),h:Math.max(MIN_H,Math.min(MAX_H,Math.round(camSize.h*f)))}
    updateBubble()
  },{passive:false})

  // ── 工具栏 ─────────────────────────────────────────────
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
    b.style.cssText="width:44px;height:44px;border-radius:14px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,outline .15s;"
    b.innerHTML=svg
    b.onmouseenter=()=>{if(!b._on)b.style.background="rgba(255,255,255,.08)"}
    b.onmouseleave=()=>{if(!b._on)b.style.background="transparent"}
    return b
  }
  function glow(b,on){
    b._on=on
    b.style.background=on?"rgba(255,214,0,.18)":"transparent"
    b.style.outline=on?"1.5px solid rgba(255,214,0,.6)":"none"
  }
  function sep(){const d=document.createElement("div");d.style.cssText="width:1px;height:20px;background:rgba(255,255,255,.08);margin:0 4px;flex-shrink:0;";return d}

  // SVG 图标（更好看）
  const IC={
    cam:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    // 美颜：脸+闪光（比五角星更直观）
    beauty:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
    // 鼠标：标准鼠标形状
    mouse:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="16" rx="5"/><path d="M12 6v4"/></svg>`,
    // 激光笔：笔尖发光
    laser:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5-11 11H4v-5L15 4z"/><circle cx="4.5" cy="19.5" r="1.5" fill="#FF3B30" stroke="none"/><path d="M19 2l3 3"/></svg>`,
    rec:`<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#FF3B30"/></svg>`,
    stop:`<svg width="16" height="16" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" fill="#fff"/></svg>`,
    close:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  }

  const bCam=mkBtn(IC.cam,"摄像头 C")
  const bBeauty=mkBtn(IC.beauty,"美颜 F")
  const bMouse=mkBtn(IC.mouse,"鼠标 M")
  const bLaser=mkBtn(IC.laser,"激光笔 L")
  const cdot=document.createElement("div")
  cdot.style.cssText=`width:16px;height:16px;border-radius:50%;background:${laserColor};border:2px solid rgba(255,255,255,.3);cursor:pointer;flex-shrink:0;margin-left:2px;transition:transform .15s;`
  cdot.onmouseenter=()=>cdot.style.transform="scale(1.2)"
  cdot.onmouseleave=()=>cdot.style.transform="scale(1)"
  const bRec=mkBtn(IC.rec,"录制 R")
  const timerEl=document.createElement("div")
  timerEl.style.cssText="font-size:12px;font-weight:700;color:rgba(255,255,255,.8);font-variant-numeric:tabular-nums;letter-spacing:.5px;min-width:34px;text-align:center;"
  timerEl.textContent="00:00"
  const bClose=mkBtn(IC.close,"关闭 Esc")

  bar.append(bCam,bBeauty,sep(),bMouse,bLaser,cdot,sep(),bRec,timerEl,sep(),bClose)
  glow(bMouse,true)

  // ── 颜色面板 ───────────────────────────────────────────
  const cpanel=document.createElement("div")
  cpanel.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(14,14,14,.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:12px;display:none;flex-wrap:wrap;gap:8px;width:192px;box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:2147483647;pointer-events:all;"
  document.body.append(cpanel)
  COLORS.forEach(c=>{
    const s=document.createElement("div")
    s.style.cssText=`width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:2.5px solid ${c===laserColor?"#fff":"transparent"};box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);transition:all .15s;`
    s.onmouseenter=()=>s.style.transform="scale(1.2)"
    s.onmouseleave=()=>s.style.transform="scale(1)"
    s.onclick=()=>{laserColor=c;cdot.style.background=c;cpanel.querySelectorAll("div").forEach(d=>d.style.borderColor="transparent");s.style.borderColor="#fff";hideCp()}
    cpanel.append(s)
  })
  const sw=document.createElement("div");sw.style.cssText="width:100%;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);"
  const sh=document.createElement("div");sh.style.cssText="display:flex;justify-content:space-between;margin-bottom:6px;"
  const sl=document.createElement("span");sl.style.cssText="font-size:11px;color:rgba(255,255,255,.4);";sl.textContent="粗细"
  const sv=document.createElement("span");sv.style.cssText="font-size:11px;color:#fff;font-weight:600;";sv.textContent=laserW+"px"
  sh.append(sl,sv)
  const si=document.createElement("input");si.type="range";si.min=2;si.max=14;si.value=laserW;si.style.cssText="width:100%;accent-color:#FFD600;"
  si.oninput=()=>{laserW=+si.value;sv.textContent=laserW+"px"}
  sw.append(sh,si);cpanel.append(sw)
  function hideCp(){cpShown=false;cpanel.style.display="none"}

  // ── 美颜面板 ───────────────────────────────────────────
  const bpanel=document.createElement("div")
  bpanel.style.cssText="position:fixed;bottom:80px;left:28px;background:rgba(14,14,14,.97);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:16px;display:none;flex-direction:column;gap:2px;width:210px;box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:2147483647;pointer-events:all;font-family:-apple-system,sans-serif;"
  document.body.append(bpanel)
  const bpt=document.createElement("div");bpt.style.cssText="font-size:12px;font-weight:700;color:rgba(255,255,255,.85);margin-bottom:10px;";bpt.textContent="美颜"
  bpanel.append(bpt)
  function mksl(label,val,cb){
    const row=document.createElement("div");row.style.cssText="display:flex;flex-direction:column;gap:5px;padding-bottom:10px;"
    const hd=document.createElement("div");hd.style.cssText="display:flex;justify-content:space-between;"
    const la=document.createElement("span");la.style.cssText="font-size:11px;color:rgba(255,255,255,.4);";la.textContent=label
    const va=document.createElement("span");va.style.cssText="font-size:11px;color:#FFD600;font-weight:600;";va.textContent=val+"%"
    hd.append(la,va)
    const inp=document.createElement("input");inp.type="range";inp.min=0;inp.max=100;inp.value=val;inp.style.cssText="width:100%;accent-color:#FFD600;"
    inp.oninput=()=>{va.textContent=inp.value+"%";cb(+inp.value)}
    row.append(hd,inp);return row
  }
  bpanel.append(mksl("磨皮",bSmooth,v=>bSmooth=v),mksl("美白",bWhite,v=>bWhite=v))
  function hideBp(){bpShown=false;bpanel.style.display="none"}

  // ── 激光逻辑 ───────────────────────────────────────────
  function setLaser(on){
    laserOn=on; glow(bLaser,on); glow(bMouse,!on)
    lc.style.pointerEvents=on?"all":"none"
    lc.style.cursor=on?"crosshair":"default"
    if(on)startLaser();else stopLaser()
  }
  lc.addEventListener("mousedown",e=>{drawing=true;trail=[{x:e.clientX,y:e.clientY,t:Date.now()}]})
  lc.addEventListener("mousemove",e=>{if(drawing)trail.push({x:e.clientX,y:e.clientY,t:Date.now()})})
  lc.addEventListener("mouseup",()=>drawing=false)
  lc.addEventListener("mouseleave",()=>drawing=false)
  function startLaser(){
    if(raf)return
    function frame(){
      const now=Date.now(),F=700
      lx.clearRect(0,0,lc.width,lc.height)
      trail=trail.filter(p=>now-p.t<F)
      for(let i=1;i<trail.length;i++){
        const a=trail[i-1],b=trail[i],al=Math.max(0,1-(now-b.t)/F)
        lx.globalAlpha=al;lx.beginPath();lx.moveTo(a.x,a.y);lx.lineTo(b.x,b.y)
        lx.strokeStyle=laserColor;lx.lineWidth=laserW*1.5;lx.lineCap="round";lx.stroke()
      }
      if(trail.length){const last=trail[trail.length-1],al=Math.max(0,1-(now-last.t)/F);lx.globalAlpha=al;lx.beginPath();lx.arc(last.x,last.y,laserW*3,0,Math.PI*2);lx.fillStyle=laserColor;lx.fill()}
      lx.globalAlpha=1; raf=requestAnimationFrame(frame)
    }
    raf=requestAnimationFrame(frame)
  }
  function stopLaser(){if(raf){cancelAnimationFrame(raf);raf=null};lx.clearRect(0,0,lc.width,lc.height);trail=[]}

  // ── 摄像头 ─────────────────────────────────────────────
  async function startCam(){
    try{
      camStream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false})
      vid.srcObject=camStream
      updateBubble()
      bubble.style.display="block"; camOn=true; glow(bCam,true)
      if(beautyOn){bCanvas.style.display="block";vid.style.display="none";bRaf=requestAnimationFrame(beautyFrame)}
    }catch(e){alert("摄像头失败："+e.message)}
  }
  function stopCam(){
    stopBRaf()
    if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}
    bubble.style.display="none"; camOn=false; glow(bCam,false)
  }
  function toggleBeauty(){
    beautyOn=!beautyOn; glow(bBeauty,beautyOn)
    if(!camOn){beautyOn&&startCam();return}
    if(beautyOn){bCanvas.style.display="block";vid.style.display="none";stopBRaf();bRaf=requestAnimationFrame(beautyFrame)}
    else{bCanvas.style.display="none";vid.style.display="block";stopBRaf()}
  }

  // ── 录制 ───────────────────────────────────────────────
  function fmt(s){return`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`}
  async function startRec(){
    try{
      const ss=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true})
      let ms=null;try{ms=await navigator.mediaDevices.getUserMedia({audio:true,video:false})}catch{}
      const tracks=[...ss.getTracks()];if(ms)tracks.push(...ms.getAudioTracks())
      chunks=[]
      recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:"video/webm;codecs=vp9"})
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)}
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:"video/webm"})
        ss.getTracks().forEach(t=>t.stop());if(ms)ms.getTracks().forEach(t=>t.stop())
        exportPanel(blob)
      }
      recorder.start();recOn=true;recSecs=0;timerEl.textContent="00:00"
      bRec.innerHTML=IC.stop;bRec.style.background="rgba(255,59,48,.15)"
      timerEl.style.color="#FF3B30"
      recTimer=setInterval(()=>{recSecs++;timerEl.textContent=fmt(recSecs)},1000)
      ss.getVideoTracks()[0].onended=stopRec
    }catch(e){console.error(e)}
  }
  function stopRec(){
    if(!recOn)return;recOn=false;clearInterval(recTimer)
    if(recorder?.state!=="inactive")recorder.stop()
    bRec.innerHTML=IC.rec;bRec.style.background="transparent"
    timerEl.style.color="rgba(255,255,255,.8)";timerEl.textContent="00:00";recSecs=0
  }

  // ── 导出面板 ───────────────────────────────────────────
  function exportPanel(blob){
    const p=document.createElement("div")
    p.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(12,12,12,.97);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:32px;width:340px;box-shadow:0 30px 80px rgba(0,0,0,.8);z-index:2147483647;pointer-events:all;font-family:-apple-system,sans-serif;color:#fff;"
    const mb=(blob.size/1024/1024).toFixed(1)
    p.innerHTML=`<div style="font-size:20px;font-weight:700;margin-bottom:4px;">录制完成</div><div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:24px;">${mb} MB</div><div id="est" style="font-size:13px;color:#FFD600;min-height:18px;margin-bottom:8px;"></div><div id="etr" style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;margin-bottom:24px;display:none;overflow:hidden;"><div id="ebar" style="height:100%;width:0%;background:linear-gradient(90deg,#FFD600,#FF9500);border-radius:2px;transition:width .3s;"></div></div><button id="emp4" style="width:100%;height:50px;border-radius:14px;border:none;background:#FFD600;color:#111;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">转换并下载 mp4</button><button id="ewbm" style="width:100%;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.7);font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;">直接下载 webm</button><button id="ecls" style="width:100%;height:36px;border-radius:12px;border:none;background:transparent;color:rgba(255,255,255,.25);font-size:13px;cursor:pointer;">关闭</button>`
    document.body.append(p)
    function dl(b,ext){const u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=`sat-${Date.now()}.${ext}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3e3)}
    p.querySelector("#ewbm").onclick=()=>{dl(blob,"webm");p.remove()}
    p.querySelector("#ecls").onclick=()=>p.remove()
    p.querySelector("#emp4").onclick=async()=>{
      const st=p.querySelector("#est"),tr=p.querySelector("#etr"),bar=p.querySelector("#ebar"),m4=p.querySelector("#emp4"),wb=p.querySelector("#ewbm")
      m4.disabled=true;wb.disabled=true;m4.style.opacity=".45"
      st.textContent="加载 FFmpeg...";tr.style.display="block";bar.style.width="8%"
      try{
        const {FFmpeg}=await import("https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js")
        const {fetchFile,toBlobURL}=await import("https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js")
        const ff=new FFmpeg()
        ff.on("progress",({progress})=>{bar.style.width=Math.round(10+progress*82)+"%";st.textContent=`转换中 ${Math.round(progress*100)}%`})
        const base="https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm"
        await ff.load({coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm")})
        bar.style.width="18%";st.textContent="处理中..."
        await ff.writeFile("in.webm",await fetchFile(blob))
        await ff.exec(["-i","in.webm","-c:v","libx264","-crf","22","-preset","fast","-c:a","aac","-b:a","128k","-movflags","+faststart","out.mp4"])
        bar.style.width="96%";st.textContent="下载中..."
        dl(new Blob([(await ff.readFile("out.mp4")).buffer],{type:"video/mp4"}),"mp4")
        bar.style.width="100%";setTimeout(()=>p.remove(),1200)
      }catch(e){st.textContent="转换失败，下载 webm";st.style.color="#FF3B30";dl(blob,"webm");m4.disabled=false;wb.disabled=false;m4.style.opacity="1"}
    }
  }

  // ── 显示/隐藏 ──────────────────────────────────────────
  function showAll(){shown=true;bar.style.display="flex";if(camOn)bubble.style.display="block"}
  function hideAll(){shown=false;bar.style.display="none";bubble.style.display="none";lc.style.pointerEvents="none";setLaser(false);stopCam();if(recOn)stopRec();hideCp();hideBp()}

  // ── 事件绑定 ───────────────────────────────────────────
  bCam.onclick=()=>camOn?stopCam():startCam()
  bBeauty.onclick=()=>{bpShown=!bpShown;bpanel.style.display=bpShown?"flex":"none";if(bpShown&&!beautyOn)toggleBeauty()}
  bMouse.onclick=()=>setLaser(false)
  bLaser.onclick=()=>setLaser(!laserOn)
  cdot.onclick=e=>{e.stopPropagation();cpShown=!cpShown;cpanel.style.display=cpShown?"flex":"none"}
  bRec.onclick=()=>recOn?stopRec():startRec()
  bClose.onclick=()=>hideAll()

  document.addEventListener("click",e=>{
    if(!cpanel.contains(e.target)&&e.target!==cdot)hideCp()
    if(!bpanel.contains(e.target)&&e.target!==bBeauty)hideBp()
  })
  document.addEventListener("keydown",e=>{
    if(!shown||["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return
    if(e.key==="l"||e.key==="L")setLaser(!laserOn)
    if(e.key==="m"||e.key==="M")setLaser(false)
    if(e.key==="c"||e.key==="C")camOn?stopCam():startCam()
    if(e.key==="r"||e.key==="R")recOn?stopRec():startRec()
    if(e.key==="f"||e.key==="F")toggleBeauty()
    if(e.key==="Escape")hideAll()
  })
  addEventListener("resize",()=>{lc.width=innerWidth;lc.height=innerHeight})

  window.__SAT__={toggle:()=>shown?hideAll():showAll()}
  showAll()
})()
