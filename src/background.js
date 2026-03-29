async function inject(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] })
  } catch (e) {
    // chrome:// 等受限页面静默失败
  }
}

// 点图标：注入当前页
chrome.action.onClicked.addListener((tab) => {
  inject(tab.id)
})

// 切换标签页：自动注入（__SAT__ 守卫防重复）
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (!tab || !tab.url || tab.url.startsWith("chrome://")) return
  inject(tabId)
})

// 同一标签页内跳转：页面加载完成后重新注入
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return
  if (!tab.url || tab.url.startsWith("chrome://")) return
  inject(tabId)
})
