# Redirect

A tiny static page that gives each locally hosted project one stable public link. The link looks up the project's current local-network address in `targets.json` and sends the visitor there.

```
https://nathan-kllolo.github.io/Redirect/?project=<name>
```

The repo is named `Redirect` (capital R), so that is the path segment in the URL. Visiting the bare URL without `?project=` lists whatever is currently hosted.

Visitors must be on the same Wi-Fi as the host PC: the link page is on the internet (HTTPS), but it redirects to a private `http://` address that only works on that network.

## Enable GitHub Pages

The repo must already have content on `main`. Then: Settings > Pages > Build and deployment > Source: **Deploy from a branch** > Branch: `main`, folder `/ (root)` > Save.

## targets.json

```json
{
  "version": 1,
  "projects": {
    "lan-host-example": { "url": "http://10.0.0.16:8080", "updated": "2026-11-17T16:00:00.000Z" }
  }
}
```

- Key: lowercase letters, digits and hyphens, 1-64 characters, not starting with a hyphen.
- `url`: a private `http://` origin (see below).
- `updated`: ISO 8601 UTC time the address was published.
- Unpublishing a project means removing its key. The committed file is `{"version":1,"projects":{}}`.

The file is normally written by the `publish-url` script in the `lan-host-example` project, but it can be edited by hand.

## Safety rules

- Only `http://` addresses that are dotted-quad IPv4 inside `10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16` are followed. No credentials, no path, no query, no hash; the port is optional. Anything else shows an error.
- The destination is never taken from the link. The query string only selects a key; the address comes from `targets.json` and is validated before use.
- Entries older than 24 hours are not auto-followed. The page shows when the project was last hosted with an "Open anyway" link.
- All page content is built with `textContent`; fetched data is never inserted as HTML.

## Tests

```
npm test
```

Uses `node:test` (Node 20+). The logic under test lives in `lib.js`, which has no browser dependencies.

## Public history

This repo is public, and so is its git history. Every address ever published stays visible in the commit log, even after the key is removed. Private addresses are not reachable from outside the network, but do not put anything sensitive in `targets.json`.
