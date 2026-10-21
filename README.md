<div align="center">

<img src="docs/icon.svg" width="72" alt="">

# Mass Tweet Deleter

Delete all your posts, replies and reposts on X. Free, open source, and it runs only in your browser.

[![CI](https://github.com/gcbra/mass-tweet-deleter/actions/workflows/ci.yml/badge.svg)](https://github.com/gcbra/mass-tweet-deleter/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/gcbra/mass-tweet-deleter)](https://github.com/gcbra/mass-tweet-deleter/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<img src="docs/screenshot.png" alt="The Mass Tweet Deleter panel: the start screen, a run in progress with deleted posts crossed out, and the finished screen in dark mode">

</div>

- **No archive needed.** It goes through your profile and deletes what it finds. Have your X archive? Use it for a faster run.
- **No API key, no account, no server.** It works with the X session you're already signed in to.
- **You can watch it work.** Each post is crossed out as it's deleted, and you can stop at any time.

> **Deleted posts are gone for good.** Download your X archive first if you want a copy.

## Install

Download `mass-tweet-deleter-extension.zip` from the [latest release](https://github.com/gcbra/mass-tweet-deleter/releases/latest) and unzip it.

**Chrome, Edge, Brave:** open `chrome://extensions`, turn on *Developer mode*, click *Load unpacked* and select the unzipped folder. Then pin the eraser icon from the puzzle-piece menu.

**Firefox 128+:** open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and pick `manifest.json` from the unzipped folder. Firefox removes temporary add-ons when it restarts.

## Use

1. Click the eraser icon. x.com opens with the panel in the top right.
2. Not signed in? Click *Log in to X* and sign in on X's own page. The panel comes back.
3. Check your handle, tick the box and click *Delete all my posts*.
4. Keep the tab open while it works. Minimize the panel if it's in your way.
5. When it says *All done*, click *Scan again*. X only lists about 3,200 of your newest posts at a time, so big accounts take a few rounds.

**Using your archive instead:** request it from *Settings → Your account → Download an archive of your data* (X can take a day). In the panel, choose *Use it instead* and pick `data/tweets.js`, plus any `tweets-part1.js`, `tweets-part2.js` files.

**No extension?** Open x.com signed in, open the browser console (`Cmd+Option+J` on Mac, `Ctrl+Shift+J` on Windows and Linux), paste the contents of [`extension/delete-tweets.js`](extension/delete-tweets.js) and press Enter. Chrome may ask you to type `allow pasting` first. The profile scan reloads the page once; paste again there and it carries on.

## How it works

The panel opens your profile's *Replies* tab and scrolls down it. Your own posts are deleted with the same request X's Delete button sends. Reposts are undone with X's own *Undo repost* button. With an archive, it skips the scrolling and deletes every post ID listed in `tweets.js`.

All of this happens in your x.com tab. The extension can only access x.com, sends nothing anywhere else, and keeps no data. See [PRIVACY.md](PRIVACY.md).

## FAQ

**Will this get my account banned?** Automating actions on X may break its terms of service. The tool deletes at a steady pace and waits whenever X asks it to slow down, but use it at your own risk.

**Does it delete likes or DMs?** No. Only posts, replies and reposts.

**It stopped working.** X changes its site often. Check for a newer [release](https://github.com/gcbra/mass-tweet-deleter/releases) or [open an issue](https://github.com/gcbra/mass-tweet-deleter/issues/new/choose) with the message the panel showed.

**Is it safe to run?** Read the code first. It's two short files: [`delete-tweets.js`](extension/delete-tweets.js) and [`background.js`](extension/background.js).

## Contributing

Bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

```bash
npm test        # unit tests
npm run lint    # Mozilla's extension linter
```

Inspired by [TweetXer](https://github.com/lucahammer/tweetXer). Released under the [MIT License](LICENSE).
