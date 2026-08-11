export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const env = (name) => process.env[name];
  const required = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_WORKFLOW"];
  for (const name of required) {
    if (!env(name)) {
      res.status(500).json({ error: `Missing server setting: ${name}` });
      return;
    }
  }

  try {
    // IMPORTANT:
    // The browser sends JSON, not multipart/form-data.
    // This avoids Vercel's req.formData()/FUNCTION_INVOCATION_FAILED issue.
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { res.status(400).json({ error: "Invalid JSON request." }); return; }
    }
    body = body || {};

    const mode = body.mode === "html" ? "html" : "url";
    const appName = String(body.appName || "My Web App").trim().slice(0, 40);
    const packageName = String(body.packageName || "com.example.mywebapp")
      .toLowerCase().replace(/[^a-z0-9_.]/g, "") || "com.example.mywebapp";
    const branch = env("GITHUB_BRANCH") || "main";

    let html = "";
    let webUrl = "";

    if (mode === "url") {
      webUrl = String(body.url || "").trim();

      if (!/^https?:\/\//i.test(webUrl)) {
        res.status(400).json({ error: "Please enter a valid HTTP(S) Website URL." });
        return;
      }

      // DO NOT fetch the URL from Vercel.
      // The Android WebView opens the URL on the user's device.
      const encoded = JSON.stringify(webUrl).replace(/</g, "\\u003c");
      const safeTitle = appName.replace(/[<>&"]/g, "");

      html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
html,body{margin:0;width:100%;height:100%;background:#fff}
</style>
</head>
<body>
<script>
const target=${encoded};
window.location.replace(target);
</script>
<noscript><a href=${JSON.stringify(webUrl)}>Open website</a></noscript>
</body>
</html>`;
    } else {
      html = String(body.html || "");

      if (!html.trim()) {
        res.status(400).json({ error: "HTML file is empty." });
        return;
      }
      if (html.length > 5000000) {
        res.status(400).json({ error: "HTML file is larger than 5 MB." });
        return;
      }
    }

    const ghHeaders = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env("GITHUB_TOKEN")}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-to-apk-builder"
    };

    const owner = env("GITHUB_OWNER");
    const repo = env("GITHUB_REPO");
    const path = "app/src/main/assets/index.html";

    const getUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;

    const oldResponse = await fetch(getUrl, { headers: ghHeaders });

    if (!oldResponse.ok) {
      const text = await oldResponse.text();
      res.status(500).json({
        error: `Cannot read ${path} from GitHub (${oldResponse.status}).`,
        details: text.slice(0, 500)
      });
      return;
    }

    const oldFile = await oldResponse.json();

    const content = Buffer.from(html, "utf8").toString("base64");

    const putResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `builder: update web content for ${appName}`,
          content,
          sha: oldFile.sha,
          branch
        })
      }
    );

    if (!putResponse.ok) {
      const text = await putResponse.text();
      res.status(500).json({
        error: `Could not update HTML on GitHub (${putResponse.status}).`,
        details: text.slice(0, 500)
      });
      return;
    }

    const commitResult = await putResponse.json();
    const sourceCommit = commitResult.commit?.sha || "";

    const workflowFile = env("GITHUB_WORKFLOW");
    const dispatchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
      {
        method: "POST",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: branch,
          inputs: {
            app_name: appName,
            package_name: packageName,
            source_mode: mode,
            web_url: webUrl,
            source_commit: sourceCommit
          }
        })
      }
    );

    if (!dispatchResponse.ok) {
      const text = await dispatchResponse.text();
      res.status(500).json({
        error: `Could not start GitHub Actions (${dispatchResponse.status}).`,
        details: text.slice(0, 500)
      });
      return;
    }

    // Give GitHub a moment to register the workflow run.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const runsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(branch)}&per_page=10`,
      { headers: ghHeaders }
    );

    if (!runsResponse.ok) {
      res.status(500).json({ error: "Workflow started, but its run could not be read." });
      return;
    }

    const runs = await runsResponse.json();
    const run = (runs.workflow_runs || []).find((r) =>
      r.head_sha === sourceCommit || r.status === "queued" || r.status === "in_progress"
    ) || runs.workflow_runs?.[0];

    if (!run) {
      res.status(500).json({ error: "Workflow started, but GitHub did not return a run yet." });
      return;
    }

    res.status(200).json({
      ok: true,
      run_id: run.id,
      source_mode: mode,
      web_url: webUrl,
      source_commit: sourceCommit
    });
  } catch (error) {
    console.error("BUILD API ERROR:", error);
    res.status(500).json({
      error: error?.message || "Server error in build function."
    });
  }
}
