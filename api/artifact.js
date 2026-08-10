import AdmZip from "adm-zip";

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
      headers: headers(),
      redirect: "follow"
    });

    if (!r.ok) {
      const body = await r.text();
      return json({ error: `GitHub artifact download failed (${r.status}).`, details: body.slice(0, 500) }, r.status);
    }

    const archive = Buffer.from(await r.arrayBuffer());
    const zip = new AdmZip(archive);
    const entries = zip.getEntries();
    const apk = entries.find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".apk"));

    if (!apk) {
      return json({ error: "The GitHub artifact does not contain an APK file." }, 500);
    }

    const apkBytes = apk.getData();
    const fileName = apk.entryName.split("/").pop() || "app.apk";

    return new Response(apkBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
        "Content-Length": String(apkBytes.length),
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (e) {
    console.error("Artifact endpoint error:", e);
    return json({ error: e?.message || "Artifact error" }, 500);
  }
}

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "GET only" }, 405);
  return GET(req);
}
