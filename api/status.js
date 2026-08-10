const env = (name) => process.env[name];

function headers() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env("GITHUB_TOKEN")}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "html-to-apk-builder"
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const runId = String(req.query.run_id || "");
  if (!runId) return res.status(400).json({ error: "run_id is required." });

  if (!env("GITHUB_TOKEN") || !env("GITHUB_OWNER") || !env("GITHUB_REPO")) {
    return res.status(500).json({ error: "Missing GitHub server settings." });
  }

  try {
    const owner = env("GITHUB_OWNER");
    const repo = env("GITHUB_REPO");

    const runRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${encodeURIComponent(runId)}`, { headers: headers() });
    if (!runRes.ok) return res.status(runRes.status).json({ error: "Could not read workflow status." });
    const run = await runRes.json();

    const out = {
      status: run.status,
      conclusion: run.conclusion,
      run_id: run.id
    };

    if (run.status === "completed" && run.conclusion === "success") {
      const ar = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts`, { headers: headers() });
      const data = await ar.json();
      const artifact = (data.artifacts || []).find(x => x.name === "html-to-apk");
      if (artifact) {
        out.artifact_url = `/api/artifact?artifact_id=${artifact.id}`;
      }
    }

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
