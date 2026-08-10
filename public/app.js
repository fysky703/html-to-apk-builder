const $ = (id) => document.getElementById(id);
let mode = "url";
let splashType = "image";
let timer = null;

const permissions = [
  ["INTERNET", "Internet access"],
  ["ACCESS_NETWORK_STATE", "Check network status"],
  ["ACCESS_WIFI_STATE", "WiFi Info"],
  ["VIBRATE", "Vibration"],
  ["WAKE_LOCK", "Keep screen active"],
  ["FOREGROUND_SERVICE", "Foreground service"],
  ["CAMERA", "Camera"],
  ["RECORD_AUDIO", "Microphone / audio recording"],
  ["ACCESS_FINE_LOCATION", "Precise location"],
  ["ACCESS_COARSE_LOCATION", "Approximate location"],
  ["POST_NOTIFICATIONS", "Notifications"],
  ["READ_MEDIA_IMAGES", "Read images"],
  ["READ_MEDIA_VIDEO", "Read videos"],
  ["READ_MEDIA_AUDIO", "Read audio"]
];

const selectedPermissions = new Set();

function renderPermissions() {
  $("permissionList").innerHTML = permissions.map(([name, desc]) => `
    <label class="permissionRow">
      <input type="checkbox" data-permission="${name}">
      <span class="checkVisual"></span>
      <span class="permissionText">
        <strong>${name}</strong>
        <small>${desc}</small>
      </span>
    </label>
  `).join("");

  document.querySelectorAll("[data-permission]").forEach(input => {
    input.addEventListener("change", () => {
      const name = input.dataset.permission;
      if (input.checked) selectedPermissions.add(name);
      else selectedPermissions.delete(name);
      updatePermissionCount();
    });
  });
}

function updatePermissionCount() {
  $("permissionCount").textContent = selectedPermissions.size;
}

renderPermissions();

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tabs:not(.splashTabs) .tab").forEach(x => x.classList.toggle("active", x.dataset.mode === mode));
  $("urlPane").classList.toggle("hidden", mode !== "url");
  $("filePane").classList.toggle("hidden", mode !== "file");
}

document.querySelectorAll(".tabs:not(.splashTabs) .tab").forEach(btn => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

function setSplashType(next) {
  splashType = next;
  document.querySelectorAll(".splashTabs .tab").forEach(x => x.classList.toggle("active", x.dataset.splash === splashType));
  ["image", "video", "url", "html"].forEach(x => $(x === "url" ? "splashUrlPane" : `splash${x[0].toUpperCase()}${x.slice(1)}Pane`).classList.add("hidden"));
  const pane = splashType === "url" ? "splashUrlPane" : `splash${splashType[0].toUpperCase()}${splashType.slice(1)}Pane`;
  $(pane).classList.remove("hidden");
}

document.querySelectorAll(".splashTabs .tab").forEach(btn => {
  btn.addEventListener("click", () => setSplashType(btn.dataset.splash));
});

function fileLabel(inputId, labelId, fallback) {
  $(inputId).addEventListener("change", () => {
    const f = $(inputId).files[0];
    $(labelId).textContent = f ? `${f.name} · ${Math.ceil(f.size / 1024)} KB` : fallback;
  });
}

fileLabel("file", "fileName", "or tap to browse");
fileLabel("icon", "iconName", "PNG/JPG/WEBP · recommended 512×512");
fileLabel("splashImage", "splashImageName", "PNG/JPG/WEBP");
fileLabel("splashVideo", "splashVideoName", "MP4/WebM · keep the file reasonably small");
fileLabel("splashHtml", "splashHtmlName", "Single HTML file · CSS/JS animation supported");

$("addPermission").addEventListener("click", () => {
  const raw = $("customPermission").value.trim();
  const value = raw.replace(/^android\.permission\./i, "").toUpperCase();
  if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
    fail("Enter a valid permission name, e.g. android.permission.BLUETOOTH_CONNECT");
    return;
  }
  selectedPermissions.add(value);
  $("customPermission").value = "";
  updatePermissionCount();
  renderCustomPermissions();
});

function renderCustomPermissions() {
  document.querySelectorAll(".customPermissionRow").forEach(x => x.remove());
  const builtIns = new Set(permissions.map(x => x[0]));
  [...selectedPermissions].filter(x => !builtIns.has(x)).forEach(name => {
    const row = document.createElement("label");
    row.className = "permissionRow customPermissionRow";
    row.innerHTML = `
      <input type="checkbox" checked data-custom-permission="${name}">
      <span class="checkVisual"></span>
      <span class="permissionText"><strong>${name}</strong><small>Custom permission</small></span>
    `;
    $("permissionList").appendChild(row);
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) selectedPermissions.add(name);
      else selectedPermissions.delete(name);
      updatePermissionCount();
    });
  });
}

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

function appendFile(fd, field, inputId, maxBytes) {
  const file = $(inputId).files[0];
  if (!file) return true;
  if (file.size > maxBytes) throw new Error(`${field} is too large. Maximum is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  fd.append(field, file);
  return true;
}

async function readApiResponse(res) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error(text || `Server returned HTTP ${res.status}`); }
  if (!res.ok) throw new Error(data.error || `Server returned HTTP ${res.status}`);
  return data;
}

async function build() {
  $("error").classList.add("hidden");
  $("download").classList.add("hidden");
  $("buildBtn").disabled = true;
  if (timer) clearTimeout(timer);

  const appName = $("appName").value.trim() || "My Web App";
  const packageName = $("packageName").value.trim();
  const versionName = $("versionName").value.trim() || "1.0";
  const versionCode = Number.parseInt($("versionCode").value, 10);

  if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(packageName)) {
    fail("Invalid package name. Example: com.example.myapp"); return;
  }
  if (!/^\d+(\.\d+){0,3}([A-Za-z0-9.-]*)$/.test(versionName)) {
    fail("Invalid version. Example: 1.0 or 1.0.1"); return;
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    fail("Build must be a positive integer."); return;
  }

  try {
    const fd = new FormData();
    fd.append("appName", appName);
    fd.append("packageName", packageName);
    fd.append("versionName", versionName);
    fd.append("versionCode", String(versionCode));
    fd.append("mode", mode);
    fd.append("splashType", splashType);
    fd.append("permissions", JSON.stringify([...selectedPermissions]));

    if (mode === "url") {
      const url = $("url").value.trim();
      if (!/^https?:\/\//i.test(url)) { fail("Enter a full URL beginning with https:// or http://"); return; }
      fd.append("url", url);
    } else {
      const file = $("file").files[0];
      if (!file) { fail("Choose an HTML file first."); return; }
      if (file.size > 5 * 1024 * 1024) { fail("HTML file must be under 5 MB."); return; }
      fd.append("html", file);
    }

    appendFile(fd, "icon", "icon", 4 * 1024 * 1024);
    if (splashType === "image") appendFile(fd, "splashImage", "splashImage", 8 * 1024 * 1024);
    if (splashType === "video") appendFile(fd, "splashVideo", "splashVideo", 15 * 1024 * 1024);
    if (splashType === "html") appendFile(fd, "splashHtml", "splashHtml", 2 * 1024 * 1024);
    if (splashType === "video_url") {
      const u = $("splashUrl").value.trim();
      if (!/^https?:\/\//i.test(u)) { fail("Enter a valid splash video URL."); return; }
      fd.append("splashUrl", u);
    }

    setStatus("Starting build…", "Uploading your HTML, icon, splash and app settings.", 8);
    const res = await fetch("/api/build", { method: "POST", body: fd });
    const data = await readApiResponse(res);

    setStatus("Build queued", "GitHub Actions is preparing the Android build.", 20);
    poll(data.run_id);
  } catch (e) {
    fail(e.message || "Build request failed.");
  }
}

async function poll(runId) {
  try {
    const res = await fetch(`/api/status?run_id=${encodeURIComponent(runId)}`);
    const data = await readApiResponse(res);

    if (data.status === "queued") {
      setStatus("Waiting…", "The build is queued on GitHub Actions.", 25);
      timer = setTimeout(() => poll(runId), 3500); return;
    }
    if (data.status === "in_progress") {
      setStatus("Building APK…", "JDK, Android SDK and Gradle are running.", 55);
      timer = setTimeout(() => poll(runId), 4000); return;
    }
    if (data.status === "completed" && data.conclusion === "success") {
      setStatus("APK ready", "Build completed successfully.", 100);
      $("download").href = data.artifact_url;
      $("download").classList.remove("hidden");
      $("buildBtn").disabled = false; return;
    }
    throw new Error(`Build ended with status: ${data.conclusion || data.status}`);
  } catch (e) { fail(e.message); }
}

$("buildBtn").addEventListener("click", build);
