# HTML → APK Builder

A web UI that accepts a website URL or an HTML file and triggers a GitHub Actions Android build.

## Architecture

Browser → Vercel API → GitHub Contents API → GitHub Actions → APK artifact.

### Important security note
Never put a GitHub token in `public/app.js`. Store it as a server-side environment variable.

## 1. GitHub repository

This builder expects an Android project repository with:

- `app/src/main/assets/index.html`
- `app/build.gradle`
- `.github/workflows/android.yml`

The included workflow template can replace the workflow you already created.

## 2. GitHub token

Create a fine-grained token with access to the target repository and Actions/Contents write permissions. Store it only on the server as:

```text
GITHUB_TOKEN=...
GITHUB_OWNER=your-github-username
GITHUB_REPO=html-to-apk
GITHUB_WORKFLOW=android.yml
```

## 3. Vercel

Deploy this folder as a Vercel project. The `api/build.js` endpoint is a serverless function.

Set the environment variables in Vercel.

## 4. GitHub workflow

Copy `github-workflow/android.yml` into your Android repository at:

`.github/workflows/android.yml`

The workflow is manually triggered and accepts `app_name` and `package_name`.

### How a build works

1. The browser sends HTML or a URL to `/api/build`.
2. The API downloads a URL when URL mode is used.
3. The API commits the generated `index.html` to the Android repository.
4. The API dispatches the GitHub workflow.
5. The API returns a `run_id`.
6. The browser polls `/api/status?run_id=...`.
7. When complete, the API returns the artifact download URL.

## Limitations of this first version

- URL mode downloads the HTML document but does not mirror every image/CSS/JS asset.
- Uploaded mode accepts one HTML file. External resources referenced by the HTML remain external.
- Concurrent builds into the same repository can overwrite each other's `index.html`. For a public multi-user service, use one isolated branch/repository per build.
- GitHub Actions artifacts are downloaded as a ZIP containing the APK.

