// Run with: node --test
const test = require('node:test')
const assert = require('node:assert')
const { parseArchive, deleteAll } = require('./delete-tweets.js')

test('parseArchive reads tweets.js and tweet-headers.js', () => {
  assert.deepStrictEqual(parseArchive('window.YTD.tweets.part0 = [{"tweet":{"id_str":"11","full_text":"a = b"}},{"tweet":{"id_str":"22"}}]'), ['11', '22'])
  assert.deepStrictEqual(parseArchive('window.YTD.tweet_headers.part0 = [{"tweet":{"tweet_id":"33"}}]'), ['33'])
  assert.deepStrictEqual(parseArchive('window.YTD.tweets.part0 = []'), [])
  assert.throws(() => parseArchive('window.YTD.like.part0 = [{"like":{"tweetId":"1"}}]'), /not a tweets file/)
  assert.throws(() => parseArchive('console.log("hi")'), /not a tweets file/)
})

const reply = (status, body = {}, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: k => headers[k] ?? null },
  json: async () => body,
})

test('deleteAll retries rate limits and network errors, reports failures', async () => {
  const responses = [
    reply(429, {}, { 'x-rate-limit-reset': '1' }), // id 1: rate limited (reset already passed), retried
    reply(200, { data: { delete_tweet: {} } }), // id 1: deleted
    Promise.reject(new Error('offline')), // id 2: network error, retried
    reply(200, { errors: [{ message: 'No status found' }] }), // id 2: failed
    reply(200, { data: { delete_tweet: {} } }), // id 3: deleted
  ]
  const sent = []
  const sleeps = []
  const result = await deleteAll(['1', '2', '3'], {
    csrf: 'tok',
    fetch: async (url, opts) => (sent.push(JSON.parse(opts.body).variables.tweet_id), responses.shift()),
    sleep: async ms => sleeps.push(ms),
    log: () => {},
  })
  assert.deepStrictEqual(result, { deleted: 2, failed: ['2'] })
  assert.deepStrictEqual(sent, ['1', '1', '2', '2', '3'])
  assert.deepStrictEqual(sleeps, [1000, 15000])
})

test('deleteAll stops when the user aborts', async () => {
  const controller = new AbortController()
  const result = await deleteAll(['1', '2', '3'], {
    csrf: 'tok',
    signal: controller.signal,
    fetch: async () => reply(200, { data: { delete_tweet: {} } }),
    onProgress: done => done === 2 && controller.abort(),
  })
  assert.deepStrictEqual(result, { deleted: 2, failed: [] })
})

test('deleteAll stops when X rejects the session', async () => {
  await assert.rejects(
    deleteAll(['1'], { csrf: 'tok', fetch: async () => reply(401), sleep: async () => {}, log: () => {} }),
    /signed in/,
  )
})
