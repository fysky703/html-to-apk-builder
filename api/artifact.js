import { Buffer } from "node:buffer";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).send("GET only");
  const id = String(req.query.artifact_id || "");
  if (!id) return res.status(400).send("artifact_id is required");

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return res.status(500).send("Missing server settings");

  const h = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "html-to-apk-builder"
  };

  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${id}/zip`, {
      headers: h,
      redirect: "follow"
    });
    if (!r.ok) return res.status(r.status).send("Artifact download failed.");

    const bytes = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="html-to-apk.zip"');
    return res.status(200).send(bytes);
  } catch (e) {
    return res.status(500).send(e.message || "Artifact error");
  }
}
