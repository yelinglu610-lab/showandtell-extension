const urlInput   = document.getElementById("urlInput")
const startBtn   = document.getElementById("startBtn")
const currentBtn = document.getElementById("currentBtn")

async function activateTab(tabId) {
  chrome.runtime.sendMessage({ type: "INJECT_AND_ACTIVATE", tabId })
  window.close()
}

currentBtn.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) activateTab(tab.id)
}

startBtn.onclick = async () => {
  let url = urlInput.value.trim()
  if (!url) { currentBtn.click(); return }
  if (!url.startsWith("http")) url = "https://" + url

  const tab = await chrome.tabs.create({ url })
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId !== tab.id || info.status !== "complete") return
    chrome.tabs.onUpdated.removeListener(listener)
    activateTab(tabId)
  })
}

urlInput.addEventListener("keydown", e => { if (e.key === "Enter") startBtn.click() })
