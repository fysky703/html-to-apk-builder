const env = (name) => process.env[name];

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "html-to-apk-builder"
  };
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function GET(req) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("run_id") || "";
  if (!runId) return json({ error: "run_id is required." }, 400);

  if (!env("GITHUB_TOKEN") || !env("GITHUB_OWNER") || !env("GITHUB_REPO")) {
    return json({ error: "Missing GitHub server settings." }, 500);
  }

  try {
    const owner = env("GITHUB_OWNER");
    const repo = env("GITHUB_REPO");

    const runRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${encodeURIComponent(runId)}`, { headers: headers() });
    if (!runRes.ok) return json({ error: "Could not read workflow status." }, runRes.status);
    const run = await runRes.json();

    const out = { status: run.status, conclusion: run.conclusion, run_id: run.id };

    if (run.status === "completed" && run.conclusion === "success") {
      const ar = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/artifacts`, { headers: headers() });
      if (!ar.ok) return json({ ...out, error: "Build succeeded but artifacts could not be read." }, ar.status);
      const data = await ar.json();
      const artifact = (data.artifacts || []).find(x => !x.expired && x.name.startsWith("html-to-apk-"));
      if (artifact) {
        out.artifact_id = artifact.id;
        out.artifact_name = artifact.name;
        out.artifact_url = `/api/artifact?artifact_id=${encodeURIComponent(artifact.id)}`;
      } else {
        out.artifact_error = "No downloadable APK artifact was found.";
      }
    }

    return json(out);
  } catch (e) {
    console.error("Status endpoint error:", e);
    return json({ error: e?.message || "Server error" }, 500);
  }
}

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "GET only" }, 405);
  return GET(req);
}
