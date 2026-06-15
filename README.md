# Immich Sign-Up

A self-service **registration webapp** for an existing [Immich](https://immich.app)
instance, with **invite codes** and **manual admin approval**.

- Public registration page asking for the same details as Immich (name, email,
  password) — the disk **quota is fixed at 5 GB** (configurable).
- **Invite code** field:
  - valid code → the account is created in Immich **immediately**;
  - missing or wrong code → the request is held as **pending** for an
    administrator to review.
- **Admin area** to create/revoke invite codes and approve/reject pending
  requests. Access is restricted to **Immich administrators** (they log in with
  their Immich credentials).
- Runs as a **single Docker container** exposed on port **2284**.

## How it works

```
Browser ──:2284──► Immich Sign-Up (Node + React)
                     ├─ uses the Immich Admin API to create users
                     ├─ verifies admins via the Immich login API (isAdmin)
                     └─ stores invite codes + pending requests in SQLite
```

Pending requests are stored locally because Immich has no "pending user"
concept — the account is only created in Immich once approved. The chosen
password is encrypted at rest (AES-256-GCM) so it can be provisioned into
Immich at approval time, then deleted from the database.

## Prerequisites

1. A running Immich instance (the provided `docker-compose.yml` stack).
2. An **admin API key**: in Immich open *Account Settings → API Keys → New API
   Key* while logged in as an administrator.

## Configuration

Copy `.env.example` and fill in the values (you can append them to the same
`.env` your Immich stack already uses):

| Variable | Description |
| --- | --- |
| `IMMICH_API_URL` | Immich server URL on the Docker network (default `http://immich-server:2283`). |
| `IMMICH_SIGNUP_API_KEY` | Immich **admin** API key. |
| `SIGNUP_SESSION_SECRET` | Random secret (`openssl rand -hex 32`). |
| `DEFAULT_QUOTA_BYTES` | Per-user quota in bytes (default `5368709120` = 5 GiB). |
| `IMMICH_PUBLIC_URL` | Public Immich URL: shown after sign-up and used as the redirect target for existing users. |
| `SIGNUP_COOKIE_SECURE` | `1` if served over HTTPS. |
| `SSO_ENABLED` | `true` to log existing users straight into Immich (needs a shared domain); `false` (default) to just validate + redirect. |
| `IMMICH_COOKIE_DOMAIN` | Shared parent domain for the SSO cookie, e.g. `.example.com`. Required when `SSO_ENABLED=true`. |

## Run with Docker

**Option A — full stack from scratch** (Immich + the sign-up webapp together):

```bash
docker compose -f docker-compose.example.yml up -d
```

This is the official Immich compose with the `immich-signup` service added.

**Option B — add to an existing Immich stack** (webapp only):

```bash
docker compose -f docker-compose.webapp.yml up -d
```

This attaches to the existing `immich` Docker network. You can also merge the
`immich-signup` service into your own `docker-compose.yml`.

Either way the webapp is exposed on <http://localhost:2284>:

- Registration page: `http://localhost:2284/`
- Admin area: `http://localhost:2284/admin`

## Container image (GHCR)

Prebuilt multi-arch images (`linux/amd64`, `linux/arm64`) are published to the
GitHub Container Registry:

```
ghcr.io/manuzzi-photo/immich-user-sign-up:0.0.2   # pinned release (Node.js 24)
ghcr.io/manuzzi-photo/immich-user-sign-up:devel   # latest development build
```

> `0.0.1` is the very first release and is built on Node.js 20; `0.0.2` and
> later are built on Node.js 24.

```bash
docker pull ghcr.io/manuzzi-photo/immich-user-sign-up:0.0.2
```

Images are built and pushed automatically by the
[`Publish container image`](.github/workflows/docker-publish.yml) GitHub Actions
workflow on every push to `main` and on every git tag. To cut a new release,
push a tag (e.g. `git tag 0.0.3 && git push origin 0.0.3`).

> **First publish:** after the first successful workflow run, open the package
> on GitHub → *Package settings* and set its visibility to **Public** so anyone
> can pull without authentication.

## Languages

The UI is available in **English** and **Italian**. The language is detected
from the browser and can be changed with the switcher in the top-right corner;
the choice is remembered in `localStorage`.

## Existing users & SSO

If someone submits the registration form with an email that **already** belongs
to an Immich account, the app validates the password and behaves according to
`SSO_ENABLED`:

- **`SSO_ENABLED=false`** (default) — on a correct password the user sees a
  message and is redirected to `IMMICH_PUBLIC_URL`; on a wrong password they are
  told the profile exists and redirected there to sign in. Works with any
  deployment.
- **`SSO_ENABLED=true`** — on a correct password the app sets Immich's own
  session cookies (`immich_access_token`, `immich_auth_type`,
  `immich_is_authenticated`) so the browser lands on Immich **already
  authenticated**.

SSO requires the webapp and Immich to share the same registrable domain
(eTLD+1), so the session cookie set with `Domain=IMMICH_COOKIE_DOMAIN` reaches
Immich. Use a reverse proxy with two subdomains:

```nginx
# signup.example.com -> the webapp
server {
  server_name signup.example.com;
  location / {
    proxy_pass http://immich-signup:2284;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;   # required so cookies get Secure
  }
}
# photos.example.com -> Immich
server {
  server_name photos.example.com;
  client_max_body_size 50000M;
  location / {
    proxy_pass http://immich-server:2283;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Then set:

```ini
SSO_ENABLED=true
IMMICH_COOKIE_DOMAIN=.example.com
IMMICH_PUBLIC_URL=https://photos.example.com
SIGNUP_COOKIE_SECURE=1
```

> The cookie names and the `auth_type=password` value are an internal contract
> of Immich (verified against its source). Pin your Immich version when relying
> on SSO. Note that `Domain=.example.com` sends the Immich session cookie to
> **all** subdomains — use a domain dedicated to Immich.

## Local development

Backend:

```bash
cd server
npm install
IMMICH_API_URL=http://localhost:2283 IMMICH_API_KEY=... SESSION_SECRET=dev npm run dev
```

Frontend (proxies `/api` to the backend on port 2284):

```bash
cd web
npm install
npm run dev   # http://localhost:5173
```

## Project layout

```
server/   Express API, SQLite access, Immich client
web/      React (Vite) frontend: registration + admin dashboard
Dockerfile                 multi-stage build (web + server)
docker-compose.example.yml full Immich stack + the sign-up service
docker-compose.webapp.yml  sign-up service only (add to an existing stack)
.env.example               configuration reference
```

## Security notes

- The admin API key never leaves the backend.
- Admin sessions are signed cookies (`httpOnly`); every admin request is
  re-validated against Immich (`/api/users/me`, `isAdmin`) so revoked admins
  lose access immediately.
- Registration and login endpoints are rate-limited.
- Pending passwords are encrypted at rest and erased once the account is
  created or the request is rejected.
