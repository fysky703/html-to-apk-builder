# HTML Or URL → APK Builder — V4

## Important fixes

1. HTML upload is sent as JSON after the browser reads the file. This avoids `req.formData is not a function` and Vercel `FUNCTION_INVOCATION_FAILED`.
2. URL mode never fetches the URL on Vercel. It creates a small local HTML redirect page; Android WebView opens the real URL on the device. This removes the server-side 403 fetch problem.
3. API handlers use the Vercel Node.js handler style (`export default function handler(req,res)`).
4. `api/artifact.js` returns the GitHub artifact ZIP directly, so no ZIP parser dependency is required.

## Environment variables

GITHUB_TOKEN
GITHUB_OWNER=fysky703
GITHUB_REPO=html-to-apk
GITHUB_BRANCH=main
GITHUB_WORKFLOW=android.yml

## Android repository

The workflow must be present at `.github/workflows/android.yml` in the Android repository (`html-to-apk`).
