// ── 录制状态（持久，跨页面跳转）──
let rec = {
  on: false,
  secs: 0,
  timer: null,
  recorder: null,
  chunks: [],
  stream: null
}

async function inject(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] })
    // 注入后同步录制状态
    if (rec.on) {
      chrome.tabs.sendMessage(tabId, { type: "REC_SYNC", secs: rec.secs }).catch(()=>{})
    }
  } catch (e) {}
}

// 点图标：注入
chrome.action.onClicked.addListener((tab) => inject(tab.id))

// 切换标签页：注入
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (!tab?.url || tab.url.startsWith("chrome://")) return
  inject(tabId)
})

// 同一标签页内跳转：页面加载完重新注入
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return
  if (!tab.url || tab.url.startsWith("chrome://")) return
  inject(tabId)
})

// ── 消息处理 ──
chrome.runtime.onMessage.addListener((msg, sender, reply) => {

  // content 发起录制
  if (msg.type === "REC_START") {
    const tabId = sender.tab.id
    chrome.tabCapture.capture({ audio: true, video: true }, (stream) => {
      if (!stream) {
        chrome.tabs.sendMessage(tabId, { type: "REC_ERROR", msg: "tabCapture 失败" }).catch(()=>{})
        return
      }
      rec.stream = stream
      rec.chunks = []
      rec.recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })
      rec.recorder.ondataavailable = e => { if (e.data.size > 0) rec.chunks.push(e.data) }
      rec.recorder.onstop = () => {
        const blob = new Blob(rec.chunks, { type: "video/webm" })
        // 通知 content 下载
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "REC_DONE",
              secs: rec.secs,
              url: URL.createObjectURL(blob)
            }).catch(()=>{})
          }
        })
        rec.on = false; rec.secs = 0
        clearInterval(rec.timer); rec.timer = null
      }
      rec.recorder.start()
      rec.on = true; rec.secs = 0
      rec.timer = setInterval(() => {
        rec.secs++
        // 广播计时给当前 tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "REC_TICK", secs: rec.secs }).catch(()=>{})
        })
      }, 1000)
    })
    return true
  }

  // content 停止录制
  if (msg.type === "REC_STOP") {
    if (rec.recorder && rec.recorder.state !== "inactive") {
      rec.recorder.stop()
      if (rec.stream) rec.stream.getTracks().forEach(t => t.stop())
    }
  }

  // content 查询录制状态
  if (msg.type === "REC_STATUS") {
    reply({ on: rec.on, secs: rec.secs })
    return true
  }
})
