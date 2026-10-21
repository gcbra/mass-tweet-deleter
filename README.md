# Mass Tweet Deleter

Delete all your tweets, replies and reposts on X (Twitter) for free. It's a small browser extension: sign in to X as usual, click *Delete everything on my profile*, and leave the tab open. No archive, no API key, no third-party server, no password handed to anyone.

> **Warning:** deleted posts are gone for good.

## How it works

The extension opens your profile's *Replies* tab and scrolls down it. Every post by you is deleted with the same request X's own Delete button sends, and every repost is undone with X's *Undo repost* button. Everything happens in your own signed-in x.com tab; nothing is sent anywhere except x.com.

Have your X archive? You can feed it `tweets.js` instead: that's faster and reaches posts X no longer shows on your profile.

## Install

Download `mass-tweet-deleter-extension.zip` from the [latest release](../../releases/latest) and unzip it.

- **Chrome, Edge, Brave:** open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and select the unzipped folder. Pin the red trash icon from the puzzle-piece menu.
- **Firefox (128+):** open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and select `manifest.json` in the unzipped folder. Firefox removes temporary add-ons when it restarts.

## Use

1. **Click the red trash icon** in your toolbar. It opens x.com with the deleter panel in the top right.
2. **Sign in.** If you're not signed in, click *Log in to X* and sign in on X's own page. The panel comes back and shows your account.
3. **Click *Delete everything on my profile*.** Check your @handle, tick the box and press *Delete all my posts*.
4. **Leave the tab open.** The panel jumps to your Replies tab and works its way down. Press *Stop* at any time.
5. **Scan again when it finishes.** X only lists roughly your newest 3,200 posts at a time, so big accounts need a few rounds. *Scan again* starts the next one.

### With your archive (optional)

On x.com go to *Settings → Your account → Download an archive of your data* and wait for X's email (it can take a day). In the panel choose *Use my X archive* and pick `data/tweets.js` from the unzipped archive, plus any `tweets-part1.js`, `tweets-part2.js`...

### No extension? Use the console

Open x.com signed in, open the browser console (`Cmd+Option+J` on Mac, `Ctrl+Shift+J` on Windows/Linux in Chrome), paste all of [`delete-tweets.js`](delete-tweets.js) and press Enter. Chrome may ask you to type `allow pasting` first. The same panel appears. Profile mode reloads the page once to open your Replies tab: paste the script again there and it carries on.

## Good to know

- Likes, bookmarks and DMs are not touched.
- Profile mode deletes about one post per second or two. Leave the tab in front if your browser slows down background tabs.
- If X rate-limits you, the panel waits and carries on by itself.
- The extension can only access x.com, and only does anything when you click its icon.
- It relies on x.com's page layout and internal web API. If X changes them, it will stop working until it's updated. Please open an issue.
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
