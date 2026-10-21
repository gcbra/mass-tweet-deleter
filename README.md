# Mass Tweet Deleter

Delete all your tweets, replies and retweets on X (Twitter) for free. It's a small browser extension: you sign in to X as usual, pick your archive file and press Delete. No API key, no third-party server, no password handed to anyone.

> **Warning:** deleted tweets are gone for good. Download and keep your archive before you start.

## How it works

Your X archive lists the ID of every tweet you ever posted. The extension reads that list and asks x.com to delete each tweet, using the same request the Delete button sends, from your own signed-in x.com tab. Nothing is sent anywhere except x.com.

## Install

Download `mass-tweet-deleter-extension.zip` from the [latest release](../../releases/latest) and unzip it.

- **Chrome, Edge, Brave:** open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and select the unzipped folder.
- **Firefox (128+):** open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and select `manifest.json` in the unzipped folder. Firefox removes temporary add-ons when it restarts.

## Use

1. **Get your archive.** On x.com go to *Settings → Your account → Download an archive of your data*. X takes up to a day or so to prepare it. Download and unzip it.
2. **Click the Mass Tweet Deleter icon** in your browser toolbar. It opens x.com with the deleter panel in the top right.
3. **Sign in.** If you're not signed in, click *Log in to X* and sign in on X's own page. The panel comes back and shows your account.
4. **Pick your tweets file:** `data/tweets.js` from the unzipped archive. Big accounts also have `tweets-part1.js`, `tweets-part2.js` and so on: select them all at once, or drag them onto the panel.
5. **Confirm and delete.** Tick the box, press *Delete*, and keep the tab open until it says *All done*. You can press *Stop* at any time.

If X rate-limits you, the panel waits and carries on by itself. If you stop or close the tab, run it again with the same file: tweets that are already gone are counted as failed and skipped.

### No extension? Use the console

Open x.com signed in, open the browser console (`Cmd+Option+J` on Mac, `Ctrl+Shift+J` on Windows/Linux in Chrome), paste all of [`delete-tweets.js`](delete-tweets.js) and press Enter. Chrome may ask you to type `allow pasting` first. The same panel appears.

## Good to know

- Only tweets in your archive are deleted. Anything posted after you requested the archive stays.
- Likes, bookmarks and DMs are not touched.
- The extension can only access x.com, and only does anything when you click its icon.
- It uses x.com's internal web API. If X changes it, deleting will stop working until the extension is updated. Please open an issue.
- Automating actions on X may break its terms of service. Use at your own risk.
- Read the code before you run it. It is two short files: [`delete-tweets.js`](delete-tweets.js) and [`background.js`](background.js).

## Development

```bash
node --test
```

Load the repo folder itself as an unpacked extension to try changes.

Inspired by [TweetXer](https://github.com/lucahammer/tweetXer).

## License

[MIT](LICENSE)
