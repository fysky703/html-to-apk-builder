# HTML → APK Builder v2

Adds, without redesigning the existing UI:

- HTML file or URL input
- App name and package name
- Version name + build number
- App icon upload
- Splash: image, video, remote video URL, or HTML animation
- Application Licensing permission selector
- GitHub Actions build
- Exact commit checkout so the APK uses the uploaded HTML/config instead of the template demo

## Required Vercel environment variables

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (usually `main`)
- `GITHUB_WORKFLOW` (usually `android.yml`)

## Android repository

The target Android repository must contain the matching WebView template and the workflow from `github-workflow/android.yml`. The Builder updates `app/src/main/assets/index.html`, `builder-config.json`, and splash/icon assets before dispatching the workflow.
