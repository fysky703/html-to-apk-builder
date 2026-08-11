export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const env = (name) => process.env[name];
  const runId = new URL(req.url, `https://${req.headers.host || "localhost"}`).searchParams.get("run_id");

  if (!runId) {
    res.status(400).json({ error: "run_id is required" });
    return;
  }

  try {
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env("GITHUB_TOKEN")}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-to-apk-builder"
    };

    const base = `https://api.github.com/repos/${env("GITHUB_OWNER")}/${env("GITHUB_REPO")}`;

    const runResponse = await fetch(`${base}/actions/runs/${runId}`, { headers });
    if (!runResponse.ok) {
      res.status(500).json({ error: `GitHub run lookup failed (${runResponse.status}).` });
      return;
    }

    const run = await runResponse.json();
    let artifact = null;

    if (run.status === "completed" && run.conclusion === "success") {
      const artifactResponse = await fetch(
        `${base}/actions/runs/${runId}/artifacts?per_page=100`,
        { headers }
      );

      if (artifactResponse.ok) {
        const data = await artifactResponse.json();
        artifact = (data.artifacts || []).find((a) => !a.expired) || null;
      }
    }

    res.status(200).json({
      status: run.status,
      conclusion: run.conclusion,
      run_id: run.id,
      html_url: run.html_url,
      artifact_id: artifact?.id || null,
      artifact_name: artifact?.name || null
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Server error in status function." });
  }
}
