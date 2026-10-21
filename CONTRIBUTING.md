# Contributing

Thanks for helping. This project stays small on purpose: two script files, no build step, no dependencies.

## Layout

- `extension/delete-tweets.js` is the whole tool: the delete logic, the profile scan and the panel UI. It must keep working when pasted into the browser console, so it stays a single file with no imports.
- `extension/background.js` opens the panel when you click the toolbar icon and brings it back after page reloads.
- `test.js` covers the archive parser and the delete loop (`npm test`).

## Trying a change

1. Load the `extension/` folder as an unpacked extension (`chrome://extensions`, Developer mode, Load unpacked).
2. After editing, click the reload icon on the extension's card, then reload x.com.
3. Test on an account you don't mind losing posts on.

## When X changes something

Most breakages come from X, not from this code:

- **Deletes fail with HTTP 404 or a GraphQL error:** the `DeleteTweet` query id in `DELETE_URL` changed. Find the new one in the Network tab when you delete a post by hand on x.com.
- **Profile mode finds nothing:** X renamed a `data-testid` the scan looks for (`tweet`, `tweetText`, `unretweet`, `unretweetConfirm`). Inspect a post on your profile to find the new names.

## Pull requests

Keep them focused, run `npm test`, and say which browser and mode you tried. Releases are made by pushing a `v*` tag that matches `version` in `extension/manifest.json`.
