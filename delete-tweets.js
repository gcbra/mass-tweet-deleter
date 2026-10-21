// Mass Tweet Deleter: deletes every tweet listed in your X archive (data/tweets.js). This cannot be undone.
// Runs on x.com, either injected by the browser extension or pasted into the browser console.
(() => {
  // x.com's own web API. shortcut: X can change this query id at any time; if deletes start failing, update it.
  const DELETE_URL = '/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet'
  // Public bearer token baked into the x.com web app (same for every user, not a secret).
  const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

  // Archive files look like: window.YTD.tweets.part0 = [{ "tweet": { "id_str": "123" } }, ...]
  function parseArchive(text) {
    let rows
    try {
      rows = JSON.parse(text.slice(text.indexOf('=') + 1))
    } catch {}
    const ids = Array.isArray(rows) ? rows.map(r => r.tweet?.id_str ?? r.tweet?.tweet_id) : []
    if (!Array.isArray(rows) || ids.some(id => !/^\d+$/.test(id))) {
      throw new Error('That is not a tweets file from an X archive. Pick data/tweets.js.')
    }
    return ids
  }

  async function deleteAll(ids, { csrf, signal, fetch = globalThis.fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.log, onProgress } = {}) {
    const transactionId = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(70))))
    const waitForReset = async res => {
      const ms = Math.max((+res.headers.get('x-rate-limit-reset') || Date.now() / 1000 + 60) * 1000 - Date.now(), 1000)
      log(`Rate limited by X, waiting ${Math.ceil(ms / 1000)}s...`)
      await sleep(ms)
    }
    let deleted = 0
    const failed = []
    for (let i = 0; i < ids.length && !signal?.aborted; i++) {
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
        throw new Error(`X refused the request (HTTP ${res.status}). Make sure you are signed in on x.com, reload the page and try again.`)
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

  const CSS = `
    :host { all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      --bg: #fff; --fg: #0f1419; --muted: #536471; --line: #cfd9de; --soft: #f7f9f9; --accent: #1d9bf0; --danger: #f4212e; --ok: #00ba7c }
    :host([data-theme=dark]) { --bg: #16181c; --fg: #e7e9ea; --muted: #8b98a5; --line: #2f3336; --soft: #202327 }
    * { box-sizing: border-box }
    [hidden] { display: none !important }
    section { width: 360px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; padding: 20px;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 16px;
      box-shadow: 0 8px 28px rgba(0,0,0,.25); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif }
    header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px }
    .logo { width: 28px; height: 28px; border-radius: 8px; background: var(--danger); display: grid; place-items: center; flex: none }
    h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 800 }
    p { margin: 0 0 12px }
    a { color: var(--accent) }
    code { font: 13px ui-monospace, Menlo, monospace; background: var(--soft); padding: 1px 5px; border-radius: 4px }
    .muted { color: var(--muted); font-size: 14px }
    .big { font-size: 20px; font-weight: 800 }
    .btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 42px; margin-top: 10px; padding: 0 16px;
      border: 1px solid transparent; border-radius: 9999px; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer }
    .primary { background: var(--fg); color: var(--bg) }
    .danger { background: var(--danger); color: #fff }
    .ghost { background: transparent; color: var(--fg); border-color: var(--line) }
    .btn:disabled { opacity: .45; cursor: not-allowed }
    .link { background: none; border: 0; padding: 0; margin-top: 12px; color: var(--accent); font: inherit; font-size: 14px; cursor: pointer }
    .icon { width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: var(--fg); font-size: 16px; cursor: pointer }
    .icon:hover, .ghost:hover { background: var(--soft) }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
    .account { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--soft); border-radius: 12px; font-weight: 600 }
    .account::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--ok) }
    ol { margin: 0 0 14px; padding-left: 20px } li { margin-bottom: 6px }
    .drop { display: block; padding: 22px 12px; text-align: center; border: 2px dashed var(--line); border-radius: 12px; cursor: pointer }
    .drop:hover, .drop.over, .drop:focus-within { border-color: var(--accent); background: var(--soft) }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap }
    .error { color: var(--danger); font-size: 14px; margin-top: 10px }
    .check { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--line); border-radius: 12px; cursor: pointer }
    .check input { margin-top: 3px; accent-color: var(--danger) }
    progress { width: 100%; height: 8px; margin: 4px 0 12px; appearance: none; border: 0; border-radius: 9999px; background: var(--soft); overflow: hidden }
    progress::-webkit-progress-bar { background: var(--soft) }
    progress::-webkit-progress-value { background: var(--accent) }
    progress::-moz-progress-bar { background: var(--accent) }`

  const HTML = `
    <section role="dialog" aria-labelledby="title">
      <header>
        <span class="logo" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 128 128" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M34 40h60M54 40V30h20v10M42 40l5 62h34l5-62"/></svg></span>
        <h2 id="title">Mass Tweet Deleter</h2>
        <button id="close" class="icon" aria-label="Close">✕</button>
      </header>

      <div data-view="login" hidden>
        <p class="big">Sign in to X</p>
        <p>Sign in to the account you want to clean up.</p>
        <a class="btn primary" href="https://x.com/i/flow/login">Log in to X</a>
        <p class="muted" style="margin-top:12px">You sign in on X's own page. This tool never sees your password.</p>
        <button id="skip" class="link">Already signed in? Continue</button>
      </div>

      <div data-view="pick" hidden>
        <p class="account" id="account"></p>
        <ol>
          <li><a href="https://x.com/settings/download_your_data" target="_blank" rel="noopener">Download your X archive</a> and unzip it. X can take a day to prepare it.</li>
          <li>Choose <code>data/tweets.js</code>. Big accounts: also pick <code>tweets-part1.js</code>, <code>tweets-part2.js</code>...</li>
        </ol>
        <label class="drop" id="drop">
          <input id="file" class="sr" type="file" accept=".js" multiple>
          <strong>Choose files</strong> or drop them here
        </label>
        <p id="pick-error" class="error" role="alert"></p>
      </div>

      <div data-view="confirm" hidden>
        <p class="big"><span id="count"></span> tweets found</p>
        <p class="muted">All of them will be deleted from your account, including replies and retweets.</p>
        <label class="check"><input id="agree" type="checkbox"> I understand deleted tweets can't be recovered.</label>
        <button id="go" class="btn danger" disabled></button>
        <button id="back" class="btn ghost">Choose different files</button>
      </div>

      <div data-view="run" hidden>
        <p class="big">Deleting...</p>
        <progress id="bar" aria-label="Deletion progress"></progress>
        <p id="run-status" role="status" aria-live="polite"></p>
        <p id="eta" class="muted"></p>
        <p id="note" class="muted"></p>
        <button id="stop" class="btn ghost">Stop</button>
      </div>

      <div data-view="done" hidden>
        <p class="big" id="done-title"></p>
        <p id="done-text"></p>
        <button id="again" class="btn ghost">Delete more</button>
      </div>
    </section>`

  function main() {
    if (document.getElementById('mass-tweet-deleter')) return
    const cookie = name => document.cookie.match(`(?:^|;\\s*)${name}=([^;]+)`)?.[1]
    const host = document.createElement('div')
    host.id = 'mass-tweet-deleter'
    const [r, g, b, a = 1] = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) ?? []).map(Number)
    host.dataset.theme = a > 0 && r + g + b < 384 ? 'dark' : 'light' // follow X's own display theme
    const ui = host.attachShadow({ mode: 'open' })
    ui.innerHTML = `<style>${CSS}</style>${HTML}`
    document.body.append(host)
    sessionStorage.setItem('mass-tweet-deleter', 'open') // lets the extension reopen the panel after a reload

    const $ = id => ui.getElementById(id)
    let view, ids = [], controller = null
    const show = name => {
      view = name
      ui.querySelectorAll('[data-view]').forEach(el => (el.hidden = el.dataset.view !== name))
    }

    // Signed in = X's session cookie or the profile link in X's sidebar is present.
    const checkAccount = () => {
      const handle = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href')?.slice(1)
      if (!cookie('twid') && !handle) return
      $('account').textContent = handle ? `Signed in as @${handle}` : 'Signed in to X'
      if (view === 'login') show('pick')
    }
    show('login')
    checkAccount()
    const poll = setInterval(checkAccount, 1500)
    $('skip').onclick = () => ($('account').textContent = 'Using your current X session', show('pick'))

    $('close').onclick = () => {
      clearInterval(poll)
      sessionStorage.removeItem('mass-tweet-deleter')
      host.remove()
    }

    const load = async files => {
      $('pick-error').textContent = ''
      try {
        const texts = await Promise.all([...files].map(f => f.text()))
        ids = [...new Set(texts.flatMap(parseArchive))]
        if (!ids.length) throw new Error('No tweets in that file, nothing to delete.')
        $('count').textContent = ids.length.toLocaleString()
        $('go').textContent = `Delete ${ids.length.toLocaleString()} tweets`
        $('agree').checked = false
        $('go').disabled = true
        show('confirm')
      } catch (err) {
        $('pick-error').textContent = err.message
      } finally {
        $('file').value = ''
      }
    }
    $('file').onchange = e => load(e.target.files)
    const drop = $('drop')
    drop.ondragover = e => (e.preventDefault(), e.stopPropagation(), drop.classList.add('over'))
    drop.ondragleave = () => drop.classList.remove('over')
    drop.ondrop = e => (e.preventDefault(), e.stopPropagation(), drop.classList.remove('over'), load(e.dataTransfer.files))
    $('agree').onchange = e => ($('go').disabled = !e.target.checked)
    $('back').onclick = $('again').onclick = () => show('pick')
    $('stop').onclick = () => controller?.abort()

    const keepOpen = e => (e.preventDefault(), (e.returnValue = ''))
    $('go').onclick = async () => {
      controller = new AbortController()
      const { signal } = controller
      const started = Date.now()
      $('bar').max = ids.length
      $('bar').value = 0
      $('run-status').textContent = $('eta').textContent = $('note').textContent = ''
      $('close').hidden = true
      addEventListener('beforeunload', keepOpen)
      show('run')
      try {
        const { deleted, failed } = await deleteAll(ids, {
          csrf: cookie('ct0'),
          signal,
          // Stop also cuts short a rate-limit wait.
          sleep: ms => new Promise(done => {
            const t = setTimeout(done, ms)
            signal.addEventListener('abort', () => (clearTimeout(t), done()), { once: true })
          }),
          log: (...args) => (console.log(...args), ($('note').textContent = args.filter(x => typeof x === 'string').join(' '))),
          onProgress: (done, d, f) => {
            $('bar').value = done
            $('run-status').textContent = `${done.toLocaleString()} of ${ids.length.toLocaleString()}: ${d.toLocaleString()} deleted, ${f.toLocaleString()} failed`
            const mins = Math.ceil(((Date.now() - started) / done) * (ids.length - done) / 60000)
            $('eta').textContent = done < ids.length ? `About ${mins} min left. Keep this tab open.` : ''
          },
        })
        $('done-title').textContent = signal.aborted ? 'Stopped' : 'All done'
        $('done-text').textContent = `${deleted.toLocaleString()} tweets deleted.` +
          (failed.length ? ` ${failed.length.toLocaleString()} could not be deleted (usually already gone). Their IDs are in the browser console.` : '')
        if (failed.length) console.log('Mass Tweet Deleter, failed tweet IDs:', failed)
      } catch (err) {
        $('done-title').textContent = 'Stopped with an error'
        $('done-text').textContent = err.message
        console.error(err)
      } finally {
        controller = null
        $('close').hidden = false
        removeEventListener('beforeunload', keepOpen)
        show('done')
      }
    }
  }

  if (typeof window === 'undefined') module.exports = { parseArchive, deleteAll }
  else main()
})()
