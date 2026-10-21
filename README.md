# Mass Tweet Deleter

Delete all your tweets, replies and retweets on X (Twitter) for free. One small script you paste into your browser. No API key, no app to install, no third-party server.

> **Warning:** deleted tweets are gone for good. Download and keep your archive before you start.

## How it works

Your X archive lists the ID of every tweet you ever posted. The script reads that list and asks x.com to delete each tweet, using the same request the Delete button sends, from your own logged-in browser tab. Nothing is sent anywhere except x.com.

## Usage

1. **Get your archive.** On x.com go to *Settings → Your account → Download an archive of your data*. X takes up to a day or so to prepare it. Download and unzip it.
2. **Open x.com** in Chrome, Firefox, Edge or Safari, logged in to the account you want to clean.
3. **Open the browser console:** `Cmd+Option+J` (Mac) or `Ctrl+Shift+J` (Windows/Linux) in Chrome and Edge, `Cmd+Option+K` / `Ctrl+Shift+K` in Firefox. Safari needs *Develop* menu enabled first.
4. **Paste the script.** Copy all of [`delete-tweets.js`](delete-tweets.js) (or grab it from the [latest release](../../releases/latest)), paste it into the console and press Enter. Chrome may ask you to type `allow pasting` first.
5. **Pick your tweets file.** A box appears top right. Choose `data/tweets.js` from the unzipped archive. Big accounts also have `tweets-part1.js`, `tweets-part2.js` and so on: select them all at once.
6. **Confirm** and leave the tab open until it says *Finished*.

If X rate-limits you, the script waits and carries on by itself. If you close the tab, run it again with the same file: tweets that are already gone are reported as failed and skipped.

## Good to know

- Only tweets in your archive are deleted. Anything posted after you requested the archive stays.
- Likes, bookmarks and DMs are not touched.
- The script uses x.com's internal web API. If X changes it, deleting will stop working until the script is updated. Please open an issue.
- Automating actions on X may break its terms of service. Use at your own risk.
- Never paste code you have not read into a browser console. This script is about 100 lines: read it first.

## Development

```bash
node --test
```

Inspired by [TweetXer](https://github.com/lucahammer/tweetXer).

## License

[MIT](LICENSE)
