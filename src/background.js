let recSecs = 0
let recOn = false
const activatedTabs = new Set() // 只有用户主动点过图标的 tab

async function inject(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] })
    if (recOn) {
      chrome.tabs.sendMessage(tabId, { type: "REC_SYNC", secs: recSecs }).catch(() => {})
    }
  } catch (e) {}
}

// 用户点图标：记录该 tab，注入
chrome.action.onClicked.addListener((tab) => {
  activatedTabs.add(tab.id)
  inject(tab.id)
})

// 同一 tab 内页面跳转：只对激活过的 tab 重新注入
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return
  if (!activatedTabs.has(tabId)) return
  if (!tab.url || tab.url.startsWith("chrome://")) return
  // 延迟 300ms 等页面渲染完
  setTimeout(() => inject(tabId), 300)
})

// tab 关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  activatedTabs.delete(tabId)
})

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument()
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Recording audio/video"
    })
  }
}

function broadcastAll(msg) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(t => chrome.tabs.sendMessage(t.id, msg).catch(() => {}))
  })
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {

  if (msg.type === "REC_START") {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage(
        { target: "offscreen", type: "REC_START" },
        (res) => {
          if (res?.ok) {
            recOn = true; recSecs = 0
          } else {
            broadcastAll({ type: "REC_ERROR", msg: res?.err || "失败" })
          }
        }
      )
    })
    return true
  }

  if (msg.type === "REC_STOP") {
    chrome.runtime.sendMessage({ target: "offscreen", type: "REC_STOP" })
    recOn = false
  }

  if (msg.type === "REC_STATUS") {
    reply({ on: recOn, secs: recSecs })
    return true
  }

  // 用户主动关闭工具栏，不再自动注入
  if (msg.type === "SAT_CLOSED") {
    if (sender.tab) activatedTabs.delete(sender.tab.id)
  }

  // 来自 offscreen
  if (msg.type === "REC_TICK") {
    recSecs = msg.secs
    broadcastAll({ type: "REC_TICK", secs: msg.secs })
  }

  if (msg.type === "REC_DONE") {
    recOn = false; recSecs = 0
    broadcastAll({ type: "REC_DONE", url: msg.url, secs: msg.secs })
  }
})
