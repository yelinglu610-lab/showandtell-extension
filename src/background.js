// ── 录制状态（跨标签持久）──
let recState = {
  on: false,
  secs: 0,
  stream: null,
  recorder: null,
  chunks: [],
  timer: null
}

async function inject(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] })
    // 注入后同步当前录制状态给 content
    if (recState.on) {
      chrome.tabs.sendMessage(tabId, { type: "REC_RESTORE", secs: recState.secs })
    }
  } catch (e) {}
}

// 点图标：注入当前页
chrome.action.onClicked.addListener((tab) => {
  inject(tab.id)
})

// 切换标签页：自动注入
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (!tab || !tab.url || tab.url.startsWith("chrome://")) return
  inject(tabId)
})

// 接收 content.js 消息
chrome.runtime.onMessage.addListener((msg, sender, reply) => {

  // content 请求当前状态
  if (msg.type === "GET_STATE") {
    chrome.storage.session.get(
      ["barLeft","barTop","collapsed","camOn"],
      (state) => reply({ ...state, recOn: recState.on, recSecs: recState.secs })
    )
    return true // 异步
  }

  // content 保存 UI 状态
  if (msg.type === "SAVE_STATE") {
    chrome.storage.session.set(msg.data)
  }

  // content 发起录制
  if (msg.type === "REC_START") {
    // 录制由 content 发起（getDisplayMedia 必须在有用户手势的页面），
    // background 只负责跨标签计时同步
    recState.on = true
    recState.secs = 0
    recState.timer = setInterval(() => {
      recState.secs++
      // 广播给所有 tab
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(t => {
          chrome.tabs.sendMessage(t.id, { type: "REC_TICK", secs: recState.secs }).catch(()=>{})
        })
      })
    }, 1000)
  }

  // content 停止录制
  if (msg.type === "REC_STOP") {
    recState.on = false
    recState.secs = 0
    clearInterval(recState.timer)
    recState.timer = null
  }
})
