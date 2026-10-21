// Toolbar button opens the Mass Tweet Deleter panel on x.com.
const inject = tabId => chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['delete-tweets.js'] })
const onX = url => /^https:\/\/x\.com\//.test(url ?? '')
const opening = new Set()

chrome.action.onClicked.addListener(async tab => {
  if (onX(tab.url)) return inject(tab.id)
  const { id } = await chrome.tabs.create({ url: 'https://x.com/home' })
  opening.add(id)
})

// Bring the panel back after a page load (e.g. signing in), until the user closes it.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !onX(tab.url)) return
  const [{ result } = {}] = await chrome.scripting
    .executeScript({ target: { tabId }, world: 'MAIN', func: () => sessionStorage.getItem('mass-tweet-deleter') })
    .catch(() => [])
  if (opening.delete(tabId) || result) inject(tabId)
})
