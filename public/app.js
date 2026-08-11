const form = document.getElementById("buildForm");
const statusEl = document.getElementById("status");
const download = document.getElementById("download");
const urlMode = document.getElementById("urlMode");
const htmlMode = document.getElementById("htmlMode");
const urlBox = document.getElementById("urlBox");
const htmlBox = document.getElementById("htmlBox");

let mode = "url";

urlMode.onclick = () => {
  mode = "url";
  urlMode.classList.add("active");
  htmlMode.classList.remove("active");
  urlBox.hidden = false;
  htmlBox.hidden = true;
};

htmlMode.onclick = () => {
  mode = "html";
  htmlMode.classList.add("active");
  urlMode.classList.remove("active");
  urlBox.hidden = true;
  htmlBox.hidden = false;
};

async function readApi(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || `Server returned HTTP ${response.status}` };
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  download.hidden = true;
  statusEl.textContent = "Preparing build...";

  try {
    const payload = {
      mode,
      appName: document.getElementById("appName").value.trim(),
      packageName: document.getElementById("packageName").value.trim(),
      url: document.getElementById("url").value.trim(),
      html: ""
    };

    if (mode === "url") {
      if (!/^https?:\/\//i.test(payload.url)) {
        throw new Error("Please enter a valid URL starting with http:// or https://");
      }
    } else {
      const file = document.getElementById("htmlFile").files[0];
      if (!file) throw new Error("Please select an HTML file.");

      statusEl.textContent = "Reading HTML file...";
      payload.html = await file.text();

      if (!payload.html.trim()) throw new Error("The HTML file is empty.");
      if (payload.html.length > 5000000) {
        throw new Error("HTML file is larger than 5 MB.");
      }
    }

    statusEl.textContent =
      mode === "url"
        ? "Sending URL to builder (the server will NOT fetch the URL)..."
        : "Sending HTML to builder...";

    const response = await fetch("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await readApi(response);

    if (!response.ok || data.error) {
      throw new Error(data.error || "Build request failed.");
    }

    const runId = data.run_id;
    statusEl.textContent = "GitHub Actions: build queued...";

    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const statusResponse = await fetch(
        `/api/status?run_id=${encodeURIComponent(runId)}`
      );
      const status = await readApi(statusResponse);

      if (!statusResponse.ok || status.error) {
        throw new Error(status.error || "Could not read GitHub build status.");
      }

      if (status.status === "completed") {
        if (status.conclusion !== "success") {
          throw new Error(
            `GitHub Actions build failed. Open: ${status.html_url || "GitHub Actions"}`
          );
        }

        if (!status.artifact_id) {
          throw new Error("Build succeeded but no APK artifact was found.");
        }

        statusEl.textContent = "Build complete. APK artifact is ready.";
        download.href = `/api/artifact?id=${encodeURIComponent(status.artifact_id)}`;
        download.hidden = false;
        return;
      }

      statusEl.textContent = `Building APK... ${status.status}`;
    }

    throw new Error("Build timed out. Please check GitHub Actions.");
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Error: ${error.message || error}`;
  }
});
