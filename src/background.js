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

// 切换标签页：自动注入到新页面（__SAT__ 守卫防重复）
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (!tab || !tab.url || tab.url.startsWith("chrome://")) return
  inject(tabId)
})

// 下载录制文件（content.js 传来 blob URL，大文件用 downloads API 更稳）
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "SAT_DOWNLOAD") {
    chrome.downloads.download({
      url: msg.blobUrl,
      filename: msg.filename,
      saveAs: false
    }, (downloadId) => {
      reply({ ok: !!downloadId })
    })
    return true // 保持 reply 通道开放
  }
})


