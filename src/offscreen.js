let recorder = null
let chunks = []
let secs = 0
let timer = null

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target !== "offscreen") return

  if (msg.type === "REC_START") {
    navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true
    }).then(stream => {
      chunks = []; secs = 0
      recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timer); timer = null
        chrome.runtime.sendMessage({ type: "REC_DONE", url, secs })
      }
      // 用户在系统层停止共享时自动停止
      stream.getVideoTracks()[0].onended = () => {
        if (recorder?.state !== "inactive") recorder.stop()
      }
      recorder.start()
      timer = setInterval(() => {
        secs++
        chrome.runtime.sendMessage({ type: "REC_TICK", secs })
      }, 1000)
      reply({ ok: true })
    }).catch(e => reply({ ok: false, err: e.message }))
    return true
  }

  if (msg.type === "REC_STOP") {
    if (recorder && recorder.state !== "inactive") recorder.stop()
  }
})
