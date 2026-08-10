import { Buffer } from "node:buffer";

const env = (name) => process.env[name];

function ghHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env("GITHUB_TOKEN")}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "html-to-apk-builder"
  };
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function normalizePackage(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function POST(req) {
  for (const n of [
    "GITHUB_TOKEN",
    "GITHUB_OWNER",
    "GITHUB_REPO",
    "GITHUB_WORKFLOW"
  ]) {
    if (!env(n)) {
      return json({ error: `Missing server setting: ${n}` }, 500);
    }
  }

  try {
    // Vercel Web-standard Functions receive a Request object.
    // This is why req.formData() works here.
    const form = await req.formData();

    const appName = String(form.get("appName") || "My Web App")
      .trim()
      .slice(0, 40);

    const packageName = normalizePackage(
      String(form.get("packageName") || "com.example.mywebapp")
    );

    const mode = String(form.get("mode") || "url");

    let html = "";

    if (mode === "file") {
      const file = form.get("html");

      if (!file || typeof file.text !== "function") {
        return json({ error: "HTML file is required." }, 400);
      }

      html = await file.text();
    } else {
      const url = String(form.get("url") || "").trim();

      if (!/^https?:\/\//i.test(url)) {
        return json(
          { error: "A valid HTTP(S) URL is required." },
          400
        );
      }

      const r = await fetch(url, { redirect: "follow" });

      if (!r.ok) {
        return json(
          { error: `Could not fetch URL (${r.status}).` },
          400
        );
      }

      html = await r.text();
    }

    if (!html || html.length > 2_500_000) {
      return json(
        { error: "HTML is empty or larger than 2.5 MB." },
        400
      );
    }

    const owner = env("GITHUB_OWNER");
    const repo = env("GITHUB_REPO");
    const branch = env("GITHUB_BRANCH") || "main";
    const path = "app/src/main/assets/index.html";

    const getUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}` +
      `?ref=${encodeURIComponent(branch)}`;

    const old = await fetch(getUrl, {
      headers: ghHeaders()
    });

    if (!old.ok) {
      return json(
        {
          error:
            `Cannot read target HTML file (${old.status}). ` +
            `Check GitHub token permissions and repository settings.`
        },
        500
      );
    }

    const oldData = await old.json();

    const putUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const putBody = {
      message: `builder: update ${safeFileName(appName)}`,
      content: Buffer.from(html, "utf8").toString("base64"),
      sha: oldData.sha,
      branch
    };

    const put = await fetch(putUrl, {
      method: "PUT",
      headers: {
        ...ghHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(putBody)
    });

    if (!put.ok) {
      const t = await put.text();

      return json(
        {
          error:
            `Could not update HTML in GitHub: ${t.slice(0, 500)}`
        },
        500
      );
    }

    const dispatchUrl =
      `https://api.github.com/repos/${owner}/${repo}` +
      `/actions/workflows/${env("GITHUB_WORKFLOW")}/dispatches`;

    const dispatch = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        ...ghHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: branch,
        inputs: {
          app_name: appName,
          package_name: packageName
        }
      })
    });

    if (!dispatch.ok) {
      const t = await dispatch.text();

      return json(
        {
          error:
            `Could not start GitHub Actions: ${t.slice(0, 500)}`
        },
        500
      );
    }

    // GitHub's workflow_dispatch endpoint normally returns 204.
    // Wait briefly, then locate the newest workflow run.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const runsUrl =
      `https://api.github.com/repos/${owner}/${repo}` +
      `/actions/workflows/${env("GITHUB_WORKFLOW")}/runs` +
      `?branch=${encodeURIComponent(branch)}&per_page=5`;

    const runs = await fetch(runsUrl, {
      headers: ghHeaders()
    });

    if (!runs.ok) {
      return json(
        { error: "Workflow started, but GitHub run status could not be read." },
        500
      );
    }

    const runsData = await runs.json();

    const run = (runsData.workflow_runs || [])
      .sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      )[0];

    if (!run) {
      return json(
        {
          error:
            "Workflow started but its run could not be found yet. Try again."
        },
        500
      );
    }

    return json({ run_id: run.id });
  } catch (e) {
    console.error("Build API error:", e);

    return json(
      { error: e?.message || "Server error" },
      500
    );
  }
}
