chrome.action.onClicked.addListener(async (tab) => {
  // 注入激光/摄像到当前页
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] })
  } catch (e) {
    console.warn("SAT inject:", e.message)
  }
  // 打开 side panel（切换标签页不消失）
  chrome.sidePanel.open({ windowId: tab.windowId })
})

// 切换标签页时自动注入到新页面
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab.url || tab.url.startsWith("chrome://")) return
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] })
  } catch (e) {
    // 静默失败（页面未加载完等情况）
  }
})
