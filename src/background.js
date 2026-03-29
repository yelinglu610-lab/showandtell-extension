chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] })
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] })
  } catch (e) {
    console.warn("SAT:", e.message)
  }
})
