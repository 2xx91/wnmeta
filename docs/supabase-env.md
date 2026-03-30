# Supabase Env

This project reads Supabase values from `.env`.

## Required values

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`SUPABASE_SECRET_KEY` is the current recommended server-side key.

`SUPABASE_SERVICE_ROLE_KEY` is still accepted as a legacy fallback, but only use it if your project has not moved to secret keys yet.

## GitHub Actions secrets

If you run this project in GitHub Actions, add the same values as repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Optional legacy fallback:

- `SUPABASE_SERVICE_ROLE_KEY`

The scheduled workflow is documented in `docs/github-actions.md`.

## Where to copy them in the Dashboard

### `SUPABASE_URL`

1. Open your Supabase project.
2. Open the project `Connect` dialog.
3. Copy the `Project URL`.

You can also find it in `Project Settings -> Data API`.

### `SUPABASE_SECRET_KEY`

1. Open your Supabase project.
2. Go to `Project Settings -> API Keys`.
3. In the new key system, create or copy a `Secret key`.
4. Paste that value into `.env` as `SUPABASE_SECRET_KEY`.

### Legacy fallback: `SUPABASE_SERVICE_ROLE_KEY`

If your project still uses the legacy JWT-style keys:

1. Go to `Project Settings -> API Keys`.
2. Open the `Legacy API Keys` tab.
3. Copy `service_role`.
4. Paste it into `.env` as `SUPABASE_SERVICE_ROLE_KEY`.

Do not keep both set unless you intentionally want `SUPABASE_SECRET_KEY` to win.

## Run commands

Because the npm scripts already use `--env-file=.env`, you can run:

```bash
npm run kakao -- --현판 1
npm run kakao -- --최신 1
npm run naver -- --판타지 1
npm run naver -- --최신 1
```

If you run Node directly, use the same flag:

```bash
node --env-file=.env src/cli/kakao.js --현판 1
node --env-file=.env src/cli/kakao.js --최신 1
node --env-file=.env src/cli/naver.js --판타지 1
node --env-file=.env src/cli/naver.js --최신 1
```
