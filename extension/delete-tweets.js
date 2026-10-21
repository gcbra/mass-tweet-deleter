// Mass Tweet Deleter: deletes your posts, replies and reposts on X. This cannot be undone.
// Runs on x.com, either injected by the browser extension or pasted into the browser console.
// Two modes: scan your profile (no archive needed), or use data/tweets.js from your X archive.
(() => {
  // x.com's own web API. shortcut: X can change this query id at any time; if deletes start failing, update it.
  const DELETE_URL = '/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet'
  // Public bearer token baked into the x.com web app (same for every user, not a secret).
  const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

  // Archive files look like: window.YTD.tweets.part0 = [{ "tweet": { "id_str": "123", "full_text": "hi" } }, ...]
  function parseArchive(text) {
    let rows
    try {
      rows = JSON.parse(text.slice(text.indexOf('=') + 1))
    } catch {}
    const posts = Array.isArray(rows) ? rows.map(r => ({ id: r.tweet?.id_str ?? r.tweet?.tweet_id, text: r.tweet?.full_text ?? '' })) : []
    if (!Array.isArray(rows) || posts.some(p => !/^\d+$/.test(p.id))) {
      throw new Error('That is not a tweets file from an X archive. Pick data/tweets.js.')
    }
    return posts
  }

  async function deleteAll(ids, { csrf, signal, fetch = globalThis.fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.log, onProgress } = {}) {
    const transactionId = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(70))))
    const waitForReset = async res => {
      const ms = Math.max((+res.headers.get('x-rate-limit-reset') || Date.now() / 1000 + 60) * 1000 - Date.now(), 1000)
      log(`X asked us to slow down. Waiting ${Math.ceil(ms / 1000)}s...`)
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
      const ok = res.ok && !body.errors?.length
      if (ok) deleted++
      else {
        failed.push(ids[i])
        log(`Could not delete ${ids[i]}:`, body.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      onProgress?.(i + 1, deleted, failed.length, ids[i], ok)
      if (res.headers.get('x-rate-limit-remaining') === '0') await waitForReset(res)
    }
    return { deleted, failed }
  }

  // No-archive mode: walks your profile's Replies tab (x.com/<handle>/with_replies) as X renders it,
  // deletes your own posts through the API and undoes reposts with X's own Undo repost button.
  // shortcut: X only lists roughly your newest 3,200 posts per visit; scanning again reaches older ones.
  async function scanProfile(handle, { texts, sleep, signal, onProgress, ...opts }) {
    const waitFor = async (selector, tries = 30) => {
      for (let t = 0; t < tries && !signal?.aborted; t++) {
        const el = document.querySelector(selector)
        if (el) return el
        await sleep(100)
      }
    }
    const page = document.scrollingElement
    const seen = new Set()
    let deleted = 0
    const failed = []
    await waitFor('article[data-testid="tweet"]', 150)
    for (let idle = 0; idle < 3 && !signal?.aborted; ) {
      const own = [], reposts = []
      for (const art of document.querySelectorAll('article[data-testid="tweet"]')) {
        // The post's timestamp links to /<author>/status/<id>.
        const [, author, id] = art.querySelector('a[href*="/status/"] time')?.closest('a')?.getAttribute('href')?.match(/^\/(\w+)\/status\/(\d+)/) ?? []
        if (!id || seen.has(id)) continue
        seen.add(id)
        const text = art.querySelector('[data-testid="tweetText"]')?.textContent ?? ''
        if (author.toLowerCase() === handle.toLowerCase()) {
          texts?.set(id, text)
          own.push([id, art])
        } else if (art.querySelector('[data-testid="unretweet"]')) {
          texts?.set(id, `Repost: ${text}`)
          reposts.push([id, art])
        }
      }
      if (own.length) {
        const r = await deleteAll(own.map(([id]) => id), {
          ...opts, sleep, signal,
          onProgress: (_, d, f, id, ok) => onProgress?.(deleted + failed.length + d + f, deleted + d, failed.length + f, id, ok),
        })
        deleted += r.deleted
        failed.push(...r.failed)
        own.forEach(([, art]) => (art.style.opacity = '0.3'))
      }
      for (const [id, art] of reposts) {
        if (signal?.aborted) break
        art.querySelector('[data-testid="unretweet"]')?.click()
        const undo = await waitFor('[data-testid="unretweetConfirm"]')
        if (undo) {
          undo.click()
          deleted++
          art.style.opacity = '0.3'
        } else {
          failed.push(id)
          document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        }
        onProgress?.(deleted + failed.length, deleted, failed.length, id, !!undo)
        await sleep(800)
      }
      if (page.scrollTop + innerHeight < page.scrollHeight - 50) {
        scrollBy(0, innerHeight * 0.8) // step down so X renders every post on the way
        await sleep(400)
        idle = 0
      } else {
        // At the bottom: wait for X to load more, give up after 3 quiet rounds.
        const height = page.scrollHeight
        scrollTo(0, height)
        for (let t = 0; t < 40 && page.scrollHeight === height && !signal?.aborted; t++) await sleep(100)
        idle = page.scrollHeight === height && !own.length && !reposts.length ? idle + 1 : 0
      }
    }
    return { deleted, failed }
  }

  // ---- Panel UI ----------------------------------------------------------------------------
  // Lives in a shadow root so x.com's styles can't reach it. System fonts only: x.com blocks web fonts.

  const CSS = `
    :host { all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647;
      --paper: #fff; --ink: #1d1e22; --pencil: #6b6e76; --line: #e4e4e8; --wash: #f5f5f7;
      --eraser: #d12f5b; --on-eraser: #fff; --tint: #fde8ee; --ok: #1f9d6a;
      --shadow: 0 1px 2px rgba(29,30,34,.06), 0 14px 36px rgba(29,30,34,.18) }
    :host([data-theme=dark]) { --paper: #1c1d21; --ink: #ededef; --pencil: #9a9da6; --line: #2e3036; --wash: #26282d;
      --eraser: #ff6b8e; --on-eraser: #1c1d21; --tint: #3a2129; --ok: #4cc38a; --shadow: 0 14px 36px rgba(0,0,0,.55) }
    * { box-sizing: border-box }
    [hidden] { display: none !important }
    section { width: 380px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto;
      background: var(--paper); color: var(--ink); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow);
      font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased }
    header { display: flex; align-items: center; gap: 10px; padding: 12px 10px 12px 16px; border-bottom: 1px solid var(--line) }
    .mark { flex: none; width: 26px; height: 26px }
    h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap }
    #mini { display: none; color: var(--pencil); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap }
    .min { width: auto }
    .min header { border-bottom: 0 }
    .min #mini { display: block }
    .min .view { display: none !important }
    .view { padding: 18px 18px 20px }
    h3 { margin: 0 0 8px; font-size: 21px; line-height: 1.25; font-weight: 700; letter-spacing: -.02em }
    h3:focus { outline: none }
    p { margin: 0 0 14px }
    a { color: inherit; text-decoration-color: var(--eraser); text-underline-offset: 3px }
    code { font: 13px ui-monospace, Menlo, monospace; background: var(--wash); padding: 1px 5px; border-radius: 5px }
    .quiet { color: var(--pencil); font-size: 13px }
    .btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; margin-top: 14px; padding: 0 16px;
      border: 1px solid var(--line); border-radius: 12px; background: var(--paper); color: var(--ink);
      font: inherit; font-weight: 650; text-decoration: none; cursor: pointer }
    .btn:hover { background: var(--wash) }
    .btn.go { background: var(--eraser); border-color: var(--eraser); color: var(--on-eraser) }
    .btn.go:hover { filter: brightness(1.07) }
    .btn:disabled { opacity: .4; cursor: not-allowed; filter: none }
    .text-btn { margin-top: 14px; padding: 0; border: 0; background: none; color: var(--pencil); font: inherit; font-size: 13px;
      text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; cursor: pointer }
    .text-btn:hover { color: var(--ink) }
    p .text-btn { margin: 0; font-size: inherit; color: var(--ink); text-decoration-color: var(--eraser) }
    .icon { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 0; border-radius: 8px;
      background: none; color: var(--pencil); cursor: pointer }
    .icon:hover { background: var(--wash); color: var(--ink) }
    :focus-visible { outline: 2px solid var(--eraser); outline-offset: 2px }
    .who { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--pencil); font-size: 13px }
    .who::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ok) }
    .field { display: block; margin-bottom: 14px; color: var(--pencil); font-size: 13px; font-weight: 600 }
    .field input { display: block; width: 100%; margin-top: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px;
      background: var(--paper); color: var(--ink); font: 15px system-ui, -apple-system, sans-serif }
    .field input:focus-visible { border-color: var(--eraser); outline-offset: 0 }
    .check { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; cursor: pointer }
    .check input { flex: none; width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--eraser) }
    .error { margin: 10px 0 0; color: var(--eraser); font-size: 13px }
    .error:empty { display: none }
    .aside { margin: 20px 0 0; padding-top: 16px; border-top: 1px solid var(--line) }
    .steps { margin: 0 0 16px; padding-left: 20px } .steps li { margin-bottom: 6px }
    .drop { display: grid; gap: 2px; padding: 22px 12px; text-align: center; border: 1.5px dashed var(--line); border-radius: 12px;
      color: var(--pencil); cursor: pointer }
    .drop strong { color: var(--ink) }
    .drop:hover, .drop.over, .drop:focus-within { border-color: var(--eraser); background: var(--tint) }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap }
    progress { display: block; width: 100%; height: 6px; margin: 14px 0 12px; appearance: none; border: 0; border-radius: 99px;
      background: var(--wash); overflow: hidden }
    progress::-webkit-progress-bar { background: var(--wash) }
    progress::-webkit-progress-value { background: var(--eraser); border-radius: 99px }
    progress::-moz-progress-bar { background: var(--eraser) }
    progress:not([value]) { background: linear-gradient(90deg, var(--wash) 30%, var(--eraser) 50%, var(--wash) 70%) 0 0 / 300% 100%;
      animation: slide 1.4s linear infinite }
    progress:not([value])::-webkit-progress-bar { background: transparent }
    .status { margin-bottom: 2px; font-weight: 650; font-variant-numeric: tabular-nums }
    /* The signature: your posts, in print, crossed out as they go. */
    .log { margin: 16px 0 0; padding: 10px 14px; list-style: none; background: var(--wash); border-radius: 12px }
    .log:empty::before { content: "Deleted posts show up here."; color: var(--pencil); font-size: 13px }
    .log li { padding: 3px 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--ink);
      font: 15px/1.45 ui-serif, Georgia, "Times New Roman", serif; animation: arrive .25s ease-out }
    .log li:nth-child(n+3) { opacity: .7 } .log li:nth-child(n+5) { opacity: .45 }
    .log .gone span { position: relative }
    .log .gone span::after { content: ""; position: absolute; left: -2px; right: -2px; top: 54%; height: 2px; border-radius: 2px;
      background: var(--eraser); transform-origin: left; animation: strike .4s .1s ease-out both }
    .log small { margin-left: 8px; color: var(--eraser); font: 12px system-ui, -apple-system, sans-serif }
    #note:empty { display: none }
    #note { margin: 10px 0 0 }
    @keyframes slide { from { background-position: 100% 0 } to { background-position: 0 0 } }
    @keyframes strike { from { transform: scaleX(0) } }
    @keyframes arrive { from { transform: translateY(-6px) } }
    @media (prefers-reduced-motion: reduce) { *, ::after { animation: none !important } }`

  const MARK = `<svg class="mark" viewBox="0 0 128 128" aria-hidden="true">
    <rect width="128" height="128" rx="30" style="fill: var(--eraser)"/>
    <g transform="rotate(-40 64 60)"><rect x="22" y="42" width="84" height="36" rx="9" fill="#fff"/>
    <path d="M54 42H31a9 9 0 0 0-9 9v18a9 9 0 0 0 9 9h23z" fill="#ffd0db"/></g>
    <path d="M30 104h44" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".55"/></svg>`

  const HTML = `
    <section role="dialog" aria-labelledby="title">
      <header>
        ${MARK}
        <h2 id="title">Mass Tweet Deleter</h2>
        <span id="mini"></span>
        <button id="min" class="icon" aria-label="Minimize" aria-expanded="true">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <button id="close" class="icon" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </header>

      <div class="view" data-view="login" hidden>
        <h3 tabindex="-1">Sign in to X</h3>
        <p>Sign in to the account you want to clean up. You do it on X's own page, so this tool never sees your password.</p>
        <a class="btn go" href="https://x.com/i/flow/login">Log in to X</a>
        <button id="skip" class="text-btn">I'm already signed in</button>
      </div>

      <div class="view" data-view="home" hidden>
        <p class="who" id="account"></p>
        <h3 tabindex="-1">Delete all your posts</h3>
        <p>Goes through your profile and deletes every post, reply and repost by you. You can stop at any time.</p>
        <label class="field">Your X handle <input id="handle" autocomplete="off" spellcheck="false" placeholder="@yourname"></label>
        <label class="check"><input id="scan-agree" type="checkbox"> I understand deleted posts can't be recovered.</label>
        <button id="scan-go" class="btn go" disabled>Delete all my posts</button>
        <p id="scan-error" class="error" role="alert"></p>
        <p class="quiet aside">Have your X archive? <button id="use-archive" class="text-btn">Use it instead</button>. It's faster and reaches very old posts.</p>
      </div>

      <div class="view" data-view="pick" hidden>
        <h3 tabindex="-1">Use your X archive</h3>
        <ol class="steps">
          <li><a href="https://x.com/settings/download_your_data" target="_blank" rel="noopener">Request your archive</a>, then unzip it when X emails you. It can take a day.</li>
          <li>Choose <code>data/tweets.js</code>. Big accounts also have <code>tweets-part1.js</code>, <code>tweets-part2.js</code> and so on: pick them all.</li>
        </ol>
        <label class="drop" id="drop">
          <input id="file" class="sr" type="file" accept=".js" multiple>
          <strong>Choose files</strong><span>or drop them here</span>
        </label>
        <p id="pick-error" class="error" role="alert"></p>
        <button class="text-btn back">Back</button>
      </div>

      <div class="view" data-view="confirm" hidden>
        <h3 tabindex="-1"><span id="count"></span> posts found</h3>
        <p>All of them will be deleted, including replies and reposts.</p>
        <label class="check"><input id="agree" type="checkbox"> I understand deleted posts can't be recovered.</label>
        <button id="go" class="btn go" disabled></button>
        <button id="repick" class="text-btn">Choose different files</button>
      </div>

      <div class="view" data-view="run" hidden>
        <h3 tabindex="-1" id="run-title"></h3>
        <progress id="bar" aria-label="Progress"></progress>
        <p class="status" id="run-status" role="status"></p>
        <p class="quiet" id="eta"></p>
        <ol class="log" id="log" aria-label="Recently deleted"></ol>
        <p class="quiet" id="note"></p>
        <button id="stop" class="btn">Stop</button>
      </div>

      <div class="view" data-view="done" hidden>
        <h3 tabindex="-1" id="done-title"></h3>
        <p id="done-text"></p>
        <button id="again" class="btn go"></button>
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
    const texts = new Map() // post id -> text, for the crossed-out list
    const show = name => {
      const hadFocus = !!ui.activeElement
      view = name
      ui.querySelectorAll('[data-view]').forEach(el => (el.hidden = el.dataset.view !== name))
      if (hadFocus) ui.querySelector(`[data-view=${name}] h3`).focus()
    }

    // Signed in = X's session cookie or the profile link in X's sidebar is present.
    const checkAccount = () => {
      const handle = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href')?.slice(1)
      if (!cookie('twid') && !handle) return
      $('account').textContent = handle ? `Signed in as @${handle}` : 'Signed in to X'
      if (handle && !$('handle').value) $('handle').value = '@' + handle
      if (view === 'login') show('home')
    }
    show('login')
    checkAccount()
    const poll = setInterval(checkAccount, 1500)

    $('skip').onclick = () => ($('account').textContent = 'Using your current X session', show('home'))
    $('use-archive').onclick = $('repick').onclick = () => show('pick')
    ui.querySelectorAll('.back').forEach(b => (b.onclick = () => show('home')))
    $('scan-agree').onchange = e => ($('scan-go').disabled = !e.target.checked)
    $('agree').onchange = e => ($('go').disabled = !e.target.checked)
    $('min').onclick = () => {
      const min = ui.querySelector('section').classList.toggle('min')
      $('min').setAttribute('aria-expanded', !min)
      $('min').setAttribute('aria-label', min ? 'Expand' : 'Minimize')
    }
    $('close').onclick = () => {
      clearInterval(poll)
      sessionStorage.removeItem('mass-tweet-deleter')
      host.remove()
    }

    const load = async files => {
      $('pick-error').textContent = ''
      try {
        const posts = (await Promise.all([...files].map(f => f.text()))).flatMap(parseArchive)
        texts.clear()
        for (const { id, text } of posts) if (!texts.get(id)) texts.set(id, text)
        ids = [...texts.keys()]
        if (!ids.length) throw new Error('No posts in that file, so there is nothing to delete.')
        $('count').textContent = ids.length.toLocaleString()
        $('go').textContent = `Delete ${ids.length.toLocaleString()} posts`
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

    // Post text is untrusted, so it only ever goes in through textContent.
    const logPost = (id, ok) => {
      const text = (texts.get(id) ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
      const li = document.createElement('li')
      li.className = ok ? 'gone' : 'kept'
      li.append(Object.assign(document.createElement('span'), { textContent: text || 'Post without text' }))
      if (!ok) li.append(Object.assign(document.createElement('small'), { textContent: "couldn't delete" }))
      $('log').prepend(li)
      $('log').children[5]?.remove()
    }

    const keepOpen = e => (e.preventDefault(), (e.returnValue = ''))
    $('stop').onclick = () => (controller?.abort(), ($('stop').textContent = 'Stopping...'))
    const run = async (mode, handle) => {
      const archive = mode === 'archive'
      controller = new AbortController()
      const { signal } = controller
      const started = Date.now()
      if (!archive) texts.clear()
      $('run-title').textContent = archive ? `Deleting ${ids.length.toLocaleString()} posts` : `Deleting @${handle}'s posts`
      if (archive) {
        $('bar').max = ids.length
        $('bar').value = 0
      } else $('bar').removeAttribute('value') // unknown total: animated bar
      $('run-status').textContent = 'Starting...'
      $('eta').textContent = 'Keep this tab open.'
      $('note').textContent = ''
      $('mini').textContent = ''
      $('log').replaceChildren()
      $('stop').textContent = 'Stop'
      $('close').hidden = true
      addEventListener('beforeunload', keepOpen)
      show('run')
      const opts = {
        csrf: cookie('ct0'),
        signal,
        texts,
        // Stop also cuts short a rate-limit wait.
        sleep: ms => new Promise(done => {
          const t = setTimeout(done, ms)
          signal.addEventListener('abort', () => (clearTimeout(t), done()), { once: true })
        }),
        log: (...args) => (console.log(...args), ($('note').textContent = args.filter(x => typeof x === 'string').join(' '))),
        onProgress: (done, d, f, id, ok) => {
          logPost(id, ok)
          const counts = `${d.toLocaleString()} deleted` + (f ? `, ${f.toLocaleString()} failed` : '')
          $('run-status').textContent = archive ? `${done.toLocaleString()} of ${ids.length.toLocaleString()}: ${counts}` : counts
          $('mini').textContent = `${d.toLocaleString()} deleted`
          if (!archive) return
          $('bar').value = done
          const mins = Math.ceil(((Date.now() - started) / done) * (ids.length - done) / 60000)
          $('eta').textContent = done < ids.length ? `About ${mins} min left. Keep this tab open.` : ''
        },
      }
      try {
        const { deleted, failed } = await (archive ? deleteAll(ids, opts) : scanProfile(handle, opts))
        const found = deleted + failed.length
        $('done-title').textContent = signal.aborted ? 'Stopped' : found ? 'All done' : 'No posts found'
        $('done-text').textContent = [
          `${deleted.toLocaleString()} ${deleted === 1 ? 'post' : 'posts'} deleted.`,
          failed.length ? `${failed.length.toLocaleString()} couldn't be deleted, usually because they were already gone. Their IDs are in the browser console.` : '',
          archive || signal.aborted ? '' : found
            ? 'X lists about 3,200 of your newest posts at a time, so scan again until nothing is left.'
            : `Nothing by @${handle} showed up. Check that the handle is yours.`,
        ].filter(Boolean).join(' ')
        if (failed.length) console.log('Mass Tweet Deleter, failed post IDs:', failed)
      } catch (err) {
        $('done-title').textContent = 'Stopped with an error'
        $('done-text').textContent = err.message
        console.error(err)
      } finally {
        controller = null
        $('close').hidden = false
        $('mini').textContent = 'Finished'
        removeEventListener('beforeunload', keepOpen)
        $('again').textContent = archive ? 'Delete more' : 'Scan again'
        // A fresh page load makes X list the posts that are left.
        $('again').onclick = archive ? () => show('home') : () => startScan(handle, true)
        show('done')
      }
    }
    $('go').onclick = () => run('archive')

    // The profile scan runs on x.com/<handle>/with_replies. Getting there reloads the page,
    // so the request is kept in sessionStorage and picked up when the panel opens again.
    const SCAN_KEY = 'mass-tweet-deleter-scan'
    const onRepliesTab = handle => location.pathname.replace(/\/$/, '').toLowerCase() === `/${handle}/with_replies`.toLowerCase()
    const startScan = (handle, reload) => {
      if (onRepliesTab(handle) && !reload) return run('scan', handle)
      sessionStorage.setItem(SCAN_KEY, handle)
      location.assign(`/${handle}/with_replies`)
    }
    $('scan-go').onclick = () => {
      const handle = $('handle').value.trim().replace(/^@/, '')
      if (!/^\w{1,15}$/.test(handle)) return ($('scan-error').textContent = 'Enter your X handle, like @yourname.')
      startScan(handle)
    }
    const pending = sessionStorage.getItem(SCAN_KEY)
    sessionStorage.removeItem(SCAN_KEY)
    if (pending && onRepliesTab(pending)) run('scan', pending)
  }

  if (typeof window === 'undefined') module.exports = { parseArchive, deleteAll }
  else main()
})()
