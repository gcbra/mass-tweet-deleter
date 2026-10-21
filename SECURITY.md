# Security

This extension runs inside your signed-in x.com tab, so bugs here can matter.

Please report security problems privately through [GitHub's private advisory form](https://github.com/gcbra/mass-tweet-deleter/security/advisories/new), not in a public issue. You'll get a reply within a week.

What the code is allowed to do, by design:

- It only has access to `https://x.com/*`.
- It sends requests only to x.com, using your existing session. It never reads or stores your password.
- It never sends data anywhere else and has no analytics.
