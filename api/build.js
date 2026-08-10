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

function json(data, status = 200) {
  return Response.json(data, { status });
}

function safeSegment(s, fallback) {
  const v = String(s || fallback).trim();
  return v.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || fallback;
}

function normalizePackage(value) {
  return String(value || "com.example.mywebapp").trim().toLowerCase();
}

function validatePackage(value) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
}

function parsePermissions(value) {
  try {
    const arr = JSON.parse(value || "[]");
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(x => String(x).trim().replace(/^android\.permission\./i, "").toUpperCase()))]
      .filter(x => /^[A-Z][A-Z0-9_]*$/.test(x));
  } catch { return []; }
}

function encode(content) {
  return Buffer.from(content).toString("base64");
}

async function getFile(owner, repo, path, branch) {
  const u = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(u, { headers: ghHeaders() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub read failed for ${path} (${r.status})`);
  return r.json();
}

async function putFile(owner, repo, path, branch, content, message) {
  const old = await getFile(owner, repo, path, branch);
  const body = {
    message,
    content: encode(content),
    branch
  };
  if (old?.sha) body.sha = old.sha;

  const u = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const r = await fetch(u, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GitHub write failed for ${path}: ${t.slice(0, 500)}`);
  }
  return r.json();
}

async function deleteFile(owner, repo, path, branch, message) {
  const old = await getFile(owner, repo, path, branch);
  if (!old?.sha) return null;
  const u = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const r = await fetch(u, {
    method: "DELETE",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: old.sha, branch })
  });
  if (!r.ok) throw new Error(`GitHub delete failed for ${path} (${r.status})`);
  return r.json();
}

async function fetchHtml(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`Could not fetch URL (${r.status}).`);
  const text = await r.text();
  if (!text || text.length > 5_000_000) throw new Error("Fetched HTML is empty or larger than 5 MB.");
  return text;
}

export async function POST(req) {
  for (const n of ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_WORKFLOW"]) {
    if (!env(n)) return json({ error: `Missing server setting: ${n}` }, 500);
  }

  try {
    const form = await req.formData();
    const owner = env("GITHUB_OWNER");
    const repo = env("GITHUB_REPO");
    const branch = env("GITHUB_BRANCH") || "main";

    const appName = String(form.get("appName") || "My Web App").trim().slice(0, 40);
    const packageName = normalizePackage(form.get("packageName"));
    const versionName = String(form.get("versionName") || "1.0").trim().slice(0, 20);
    const versionCode = Number.parseInt(String(form.get("versionCode") || "1"), 10);
    const mode = String(form.get("mode") || "file");
    const splashType = String(form.get("splashType") || "image");
    const permissions = parsePermissions(form.get("permissions"));

    if (!validatePackage(packageName)) return json({ error: "Invalid package name." }, 400);
    if (!/^\d+(\.\d+){0,3}([A-Za-z0-9.-]*)$/.test(versionName)) return json({ error: "Invalid version." }, 400);
    if (!Number.isInteger(versionCode) || versionCode < 1) return json({ error: "Invalid build number." }, 400);

    let html = "";
    if (mode === "file") {
      const file = form.get("html");
      if (!file || typeof file.text !== "function") return json({ error: "HTML file is required." }, 400);
      html = await file.text();
    } else {
      const url = String(form.get("url") || "").trim();
      if (!/^https?:\/\//i.test(url)) return json({ error: "A valid HTTP(S) URL is required." }, 400);
      html = await fetchHtml(url);
    }

    if (!html) return json({ error: "HTML is empty." }, 400);

    // Update the exact website content used by the APK.
    let lastSha = (await putFile(
      owner, repo,
      "app/src/main/assets/index.html",
      branch,
      html,
      `builder: update website for ${safeSegment(appName, "app")}`
    )).commit.sha;

    // Optional icon. If not supplied, leave the existing template icon untouched.
    const icon = form.get("icon");
    if (icon && typeof icon.arrayBuffer === "function") {
      const bytes = Buffer.from(await icon.arrayBuffer());
      if (bytes.length > 4 * 1024 * 1024) return json({ error: "Icon is too large." }, 400);
      const result = await putFile(
        owner, repo,
        "app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
        branch,
        bytes,
        `builder: update icon for ${safeSegment(appName, "app")}`
      );
      lastSha = result.commit.sha;
    }

    // Splash assets/config are replaced on every build so the APK never keeps stale settings.
    await putFile(owner, repo, "app/src/main/assets/splash/splash-config.json", branch,
      JSON.stringify({ type: splashType, videoUrl: String(form.get("splashUrl") || "") }, null, 2),
      `builder: update splash config for ${safeSegment(appName, "app")}`
    );

    const splashImage = form.get("splashImage");
    const splashVideo = form.get("splashVideo");
    const splashHtml = form.get("splashHtml");

    if (splashType === "image" && splashImage?.arrayBuffer) {
      const bytes = Buffer.from(await splashImage.arrayBuffer());
      if (bytes.length > 8 * 1024 * 1024) return json({ error: "Splash image is too large." }, 400);
      await putFile(owner, repo, "app/src/main/assets/splash/splash-image.bin", branch, bytes,
        `builder: update splash image for ${safeSegment(appName, "app")}`);
    } else if (splashType === "video" && splashVideo?.arrayBuffer) {
      const bytes = Buffer.from(await splashVideo.arrayBuffer());
      if (bytes.length > 15 * 1024 * 1024) return json({ error: "Splash video is too large." }, 400);
      await putFile(owner, repo, "app/src/main/assets/splash/splash-video.mp4", branch, bytes,
        `builder: update splash video for ${safeSegment(appName, "app")}`);
    } else if (splashType === "html" && splashHtml?.arrayBuffer) {
      const text = await splashHtml.text();
      if (text.length > 2_000_000) return json({ error: "Splash HTML is too large." }, 400);
      await putFile(owner, repo, "app/src/main/assets/splash/splash.html", branch, text,
        `builder: update splash HTML for ${safeSegment(appName, "app")}`
      );
    }

    // Write a build configuration consumed by the Android workflow.
    const config = {
      appName,
      packageName,
      versionName,
      versionCode,
      splashType,
      splashUrl: String(form.get("splashUrl") || ""),
      permissions
    };
    const cfgResult = await putFile(
      owner, repo,
      "app/src/main/assets/builder-config.json",
      branch,
      JSON.stringify(config, null, 2),
      `builder: update app config for ${safeSegment(appName, "app")}`
    );
    lastSha = cfgResult.commit.sha;

    const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${env("GITHUB_WORKFLOW")}/dispatches`;
    const dispatch = await fetch(dispatchUrl, {
      method: "POST",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: branch, inputs: { app_name: appName, package_name: packageName, version_name: versionName, version_code: String(versionCode), splash_type: splashType, config_sha: lastSha } })
    });
    if (!dispatch.ok) {
      const t = await dispatch.text();
      return json({ error: `Could not start GitHub Actions: ${t.slice(0, 700)}` }, 500);
    }

    await new Promise(r => setTimeout(r, 1500));
    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${env("GITHUB_WORKFLOW")}/runs?branch=${encodeURIComponent(branch)}&per_page=10`;
    const runs = await fetch(runsUrl, { headers: ghHeaders() });
    if (!runs.ok) return json({ error: "Workflow started, but run status could not be read." }, 500);
    const runsData = await runs.json();
    const run = (runsData.workflow_runs || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (!run) return json({ error: "Workflow started but its run could not be found yet." }, 500);

    return json({ run_id: run.id });
  } catch (e) {
    console.error("Build API error:", e);
    return json({ error: e?.message || "Server error" }, 500);
  }
}
