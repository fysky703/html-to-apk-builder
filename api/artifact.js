import { unzipSync } from "fflate";

const env = (name) => process.env[name];

function ghHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env("GITHUB_TOKEN")}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "html-to-apk-builder"
  };
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("artifact_id") || "";

  if (!id) return json({ error: "artifact_id is required" }, 400);

  const token = env("GITHUB_TOKEN");
  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");

  if (!token || !owner || !repo) {
    return json({ error: "Missing GitHub server settings." }, 500);
  }

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${encodeURIComponent(id)}/zip`;
    const r = await fetch(apiUrl, {
      headers: ghHeaders(),
      redirect: "follow"
    });

    if (!r.ok) {
      const body = await r.text();
      return json({
        error: `GitHub artifact download failed (${r.status}).`,
        details: body.slice(0, 800)
      }, r.status);
    }

    const archive = new Uint8Array(await r.arrayBuffer());
    const files = unzipSync(archive);
    const names = Object.keys(files);
    const apkName = names.find(n => !n.endsWith("/") && n.toLowerCase().endsWith(".apk"));

    if (!apkName) {
      return json({
        error: "The GitHub artifact does not contain an APK file.",
        files: names.slice(0, 30)
      }, 500);
    }

    const apkBytes = files[apkName];
    const fileName = apkName.split("/").pop() || "app.apk";
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    return new Response(apkBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (e) {
    console.error("Artifact endpoint error:", e);
    return json({
      error: e?.message || "Artifact error",
      hint: "Check Vercel deployment logs for /api/artifact."
    }, 500);
  }
}

export default GET;
