let toolbarWinId = null

chrome.action.onClicked.addListener(async (tab) => {
  // 如果窗口已开，关掉
  if (toolbarWinId !== null) {
    try { await chrome.windows.remove(toolbarWinId) } catch {}
    toolbarWinId = null
    return
  }
  // 先注入激光 content script 到当前 tab
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] })
  } catch (e) {
    console.warn("SAT inject:", e.message)
  }
  // 开独立悬浮窗口（置顶，no-frame popup）
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("toolbar.html"),
    type: "popup",
    width: 620,
    height: 58,
    top: 20,
    left: Math.round((screen.width - 620) / 2),
    focused: false,
  })
  toolbarWinId = win.id
})

// 窗口关闭时清除 id
chrome.windows.onRemoved.addListener(id => {
  if (id === toolbarWinId) toolbarWinId = null
})
