# GitHub Actions Batch Setup

This repository includes a scheduled workflow at `.github/workflows/daily-sync.yml`.

## What it does

- Runs the KakaoPage latest sync once per day
- Runs the Naver Series latest sync once per day
- Supports manual runs from the GitHub Actions UI
- Supports an optional `max_pages` limit for manual runs

The current schedule is:

- Every day at `03:17` in `Asia/Seoul`

## Required GitHub secrets

Add these in `Repository -> Settings -> Secrets and variables -> Actions`.

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

Optional legacy fallback:

- `SUPABASE_SERVICE_ROLE_KEY`

The workflow requires `SUPABASE_URL` and at least one of `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.

## Recommended repository settings

- Push the workflow file to the default branch
- Use repository-level secrets unless you intentionally manage secrets at the organization or environment level
- Keep GitHub Actions enabled for the repository
- Do not commit `.env` or `node_modules`

## Manual run

Open `Actions -> Daily Webnovel Sync -> Run workflow`.

Inputs:

- `provider`: `all`, `kakao`, or `naver`
- `max_pages`: optional page limit for a one-off test run

Examples:

- Full latest sync for both providers: `provider=all`
- Kakao only test run: `provider=kakao`, `max_pages=1`
- Naver only test run: `provider=naver`, `max_pages=2`

## Notes

- The scheduled run uses the latest commit on the default branch.
- The daily job runs Kakao and Naver as separate matrix jobs, so one provider failing does not prevent the other provider from running.
- The local npm scripts use `.env`, but the GitHub Actions workflow injects the same values through repository secrets instead.
