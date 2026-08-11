export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const artifactId = url.searchParams.get("id");

  if (!artifactId) {
    res.status(400).json({ error: "artifact id is required" });
    return;
  }

  try {
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "html-to-apk-builder"
    };

    const apiUrl =
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/artifacts/${artifactId}/zip`;

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      const text = await response.text();
      res.status(500).json({
        error: `GitHub artifact download failed (${response.status}).`,
        details: text.slice(0, 500)
      });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // GitHub returns a ZIP containing the APK.
    // The download endpoint returns the ZIP here with a clear filename.
    // No ZIP parsing dependency is required in the Vercel function.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="apk-build-${artifactId}.zip"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Server error in artifact function." });
  }
}
