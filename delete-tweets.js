// Mass Tweet Deleter: paste into the browser console on x.com while logged in.
// Deletes every tweet listed in your X archive (data/tweets.js). This cannot be undone.
(() => {
  // x.com's own web API. shortcut: X can change this query id at any time; if deletes start failing, update it.
  const DELETE_URL = '/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet'
  // Public bearer token baked into the x.com web app (same for every user, not a secret).
  const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

  // Archive files look like: window.YTD.tweets.part0 = [{ "tweet": { "id_str": "123" } }, ...]
  function parseArchive(text) {
    const rows = JSON.parse(text.slice(text.indexOf('=') + 1))
    const ids = Array.isArray(rows) ? rows.map(r => r.tweet?.id_str ?? r.tweet?.tweet_id) : []
    if (!Array.isArray(rows) || ids.some(id => !/^\d+$/.test(id))) {
      throw new Error('Not a tweets file from an X archive. Pick data/tweets.js.')
    }
    return ids
  }

  async function deleteAll(ids, { csrf, fetch = globalThis.fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.log, onProgress } = {}) {
    const transactionId = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(70))))
    const waitForReset = async res => {
      const ms = Math.max((+res.headers.get('x-rate-limit-reset') || Date.now() / 1000 + 60) * 1000 - Date.now(), 1000)
      log(`Rate limited by X, waiting ${Math.ceil(ms / 1000)}s...`)
      await sleep(ms)
    }
    let deleted = 0
    const failed = []
    for (let i = 0; i < ids.length; i++) {
      let res
      try {
        res = await fetch(DELETE_URL, {
          method: 'POST',
          credentials: 'include',
          headers: {
            authorization: 'Bearer ' + BEARER,
            'content-type': 'application/json',
            'x-csrf-token': csrf,
            'x-client-transaction-id': transactionId,
            'x-twitter-active-user': 'yes',
            'x-twitter-auth-type': 'OAuth2Session',
          },
          body: JSON.stringify({ variables: { tweet_id: ids[i], dark_request: false }, queryId: DELETE_URL.split('/')[4] }),
          signal: AbortSignal.timeout(15000),
        })
      } catch (err) {
        log(`Network error on ${ids[i]}, retrying in 15s`, err)
        await sleep(15000)
        i--
        continue
      }
      if (res.status === 429) {
        await waitForReset(res)
        i--
        continue
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`X refused the request (HTTP ${res.status}). Make sure you are logged in on x.com, reload, and paste the script again.`)
      }
      const body = await res.json().catch(() => ({}))
      if (res.ok && !body.errors?.length) deleted++
      else {
        failed.push(ids[i])
        log(`Could not delete ${ids[i]}:`, body.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      onProgress?.(i + 1, deleted, failed.length)
      if (res.headers.get('x-rate-limit-remaining') === '0') await waitForReset(res)
    }
    return { deleted, failed }
  }

  function main() {
    const csrf = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1]
    if (!/(^|\.)(x|twitter)\.com$/.test(location.hostname) || !csrf) {
      return alert('Open x.com, log in, then paste this script into the console again.')
    }
    const box = document.createElement('div')
    box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;max-width:340px;padding:16px;background:#fff;color:#0f1419;border:2px solid #f4212e;border-radius:12px;font:15px/1.4 system-ui,sans-serif'
    box.innerHTML = `<b>Mass Tweet Deleter</b>
      <p>Pick <code>data/tweets.js</code> from your X archive (also any <code>tweets-part1.js</code>, <code>tweets-part2.js</code>...).</p>
      <input type="file" accept=".js" multiple aria-label="X archive tweets files">
      <p role="status"></p>`
    document.body.append(box)
    const status = box.querySelector('[role=status]')
    const input = box.querySelector('input')
    input.onchange = async () => {
      try {
        const texts = await Promise.all([...input.files].map(f => f.text()))
        const ids = [...new Set(texts.flatMap(parseArchive))]
        if (!ids.length) return (status.textContent = 'No tweets found in that file.')
        if (!confirm(`Permanently delete ${ids.length} tweets? This cannot be undone.`)) return (input.value = '')
        input.disabled = true
        const { deleted, failed } = await deleteAll(ids, {
          csrf,
          onProgress: (done, d, f) => (status.textContent = `${done} / ${ids.length} processed: ${d} deleted, ${f} failed. Keep this tab open.`),
        })
        status.textContent = `Finished: ${deleted} deleted, ${failed.length} failed.` + (failed.length ? ' Failed IDs are in the console.' : '')
        if (failed.length) console.log('Failed tweet IDs:', failed)
      } catch (err) {
        status.textContent = 'Error: ' + err.message
        console.error(err)
      }
    }
  }

  if (typeof window === 'undefined') module.exports = { parseArchive, deleteAll }
  else main()
})()
