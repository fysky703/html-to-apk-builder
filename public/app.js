const $ = (id) => document.getElementById(id);
let mode = "url";
let timer = null;

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === btn));
    $("urlPane").classList.toggle("hidden", mode !== "url");
    $("filePane").classList.toggle("hidden", mode !== "file");
  });
});

$("file").addEventListener("change", () => {
  const f = $("file").files[0];
  $("fileName").textContent = f ? f.name : "or tap to browse";
});

function setStatus(title, text, pct) {
  $("status").classList.remove("hidden");
  $("statusTitle").textContent = title;
  $("statusText").textContent = text;
  $("statusPct").textContent = `${pct}%`;
  $("bar").style.width = `${pct}%`;
}

function fail(message) {
  $("error").textContent = message;
  $("error").classList.remove("hidden");
  $("buildBtn").disabled = false;
}

async function build() {
  $("error").classList.add("hidden");
  $("download").classList.add("hidden");
  $("buildBtn").disabled = true;

  const appName = $("appName").value.trim() || "My Web App";
  const packageName = $("packageName").value.trim();

  if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(packageName)) {
    fail("Invalid package name. Example: com.example.myapp");
    return;
  }

  const fd = new FormData();
  fd.append("appName", appName);
  fd.append("packageName", packageName);
  fd.append("mode", mode);

  if (mode === "url") {
    const url = $("url").value.trim();
    if (!/^https?:\/\//i.test(url)) {
      fail("Enter a full URL beginning with https:// or http://");
      return;
    }
    fd.append("url", url);
  } else {
    const file = $("file").files[0];
    if (!file) {
      fail("Choose an HTML file first.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      fail("For this starter version, keep the HTML file under 2 MB.");
      return;
    }
    fd.append("html", file);
  }

  try {
    setStatus("Starting build…", "Sending your website to the build server.", 12);
    const res = await fetch("/api/build", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Build request failed.");

    setStatus("Build queued", "GitHub Actions is preparing the Android build.", 20);
    poll(data.run_id);
  } catch (e) {
    fail(e.message);
  }
}

async function poll(runId) {
  try {
    const res = await fetch(`/api/status?run_id=${encodeURIComponent(runId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Status check failed.");

    if (data.status === "queued") {
      setStatus("Waiting…", "The build is queued on GitHub Actions.", 25);
      timer = setTimeout(() => poll(runId), 3500);
      return;
    }

    if (data.status === "in_progress") {
      setStatus("Building APK…", "JDK, Android SDK and Gradle are running.", 55);
      timer = setTimeout(() => poll(runId), 4000);
      return;
    }

    if (data.status === "completed" && data.conclusion === "success") {
      setStatus("APK ready", "Build completed successfully.", 100);
      $("download").href = data.artifact_url;
      $("download").classList.remove("hidden");
      $("buildBtn").disabled = false;
      return;
    }

    throw new Error(`Build ended with status: ${data.conclusion || data.status}`);
  } catch (e) {
    fail(e.message);
  }
}

$("buildBtn").addEventListener("click", build);
