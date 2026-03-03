const DEFAULT_PROMPT = `Edit this product photo into a premium e-commerce studio image of the same Murano glass piece.
Do not change the object: keep identical shape, proportions, color tones, pattern details (murrine / gold leaf / bubbles), transparency, and surface texture. No redesign, no added elements, no smoothing that removes glass character.
Background: clean seamless light-grey studio backdrop (paper sweep), subtle soft gradient allowed, no texture, no props.
Lighting: professional diffused softbox lighting, balanced highlights to show glass volume, realistic reflections only (no scene reflections).
Shadow/contact: add a soft natural contact shadow directly under the piece so it sits on the surface (not floating).
Perspective: centered, upright verticals, minimal distortion (product lens look).
Retouching: remove dust, fingerprints, and background noise; keep edges crisp and glass highlights natural.
Color: neutral white balance, accurate Murano colors (no oversaturation).
Output: sharp, clean, catalog-ready.
Avoid: changing colors/patterns, warped geometry, extra decorations, text/watermarks, harsh shadows, blown highlights, plastic look, painterly/CGI look, artifacts around edges.`;

const imageInput = document.getElementById("imageInput");
const promptInput = document.getElementById("promptInput");
const apiBaseInput = document.getElementById("apiBaseInput");
const generateBtn = document.getElementById("generateBtn");
const statusNode = document.getElementById("status");
const originalPreview = document.getElementById("originalPreview");
const resultPreview = document.getElementById("resultPreview");
const downloadLink = document.getElementById("downloadLink");

promptInput.value = DEFAULT_PROMPT;
setDownloadState(null);

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) {
    originalPreview.removeAttribute("src");
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  originalPreview.src = objectUrl;
  statusNode.textContent = "Image selected.";
});

generateBtn.addEventListener("click", async () => {
  const file = imageInput.files?.[0];
  if (!file) {
    statusNode.textContent = "Please choose an image first.";
    return;
  }

  const apiBase = (apiBaseInput.value || "").trim().replace(/\/$/, "");
  if (!apiBase) {
    statusNode.textContent = "Please provide API base URL.";
    return;
  }

  generateBtn.disabled = true;
  setDownloadState(null);
  statusNode.textContent = "Checking backend health...";

  try {
    await checkHealth(apiBase);

    statusNode.textContent = "Processing... this can take up to ~90 seconds with free model queues.";

    const form = new FormData();
    form.append("image", file);
    form.append("prompt", promptInput.value.trim() || DEFAULT_PROMPT);

    const resp = await fetch(`${apiBase}/api/edit-photo`, {
      method: "POST",
      body: form,
    });

    if (!resp.ok) {
      const err = await tryParseError(resp);
      throw new Error(err || `Request failed (${resp.status})`);
    }

    const blob = await resp.blob();
    const resultUrl = URL.createObjectURL(blob);
    const engine = resp.headers.get("X-Engine") || "unknown";
    resultPreview.src = resultUrl;
    setDownloadState(resultUrl);
    statusNode.textContent = `Done. Engine: ${engine}. Review output and download if it looks correct.`;
  } catch (err) {
    statusNode.textContent = `Failed: ${formatError(err, apiBase)}`;
  } finally {
    generateBtn.disabled = false;
  }
});

async function checkHealth(apiBase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`${apiBase}/api/health`, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`Backend health check failed (${resp.status})`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function tryParseError(resp) {
  try {
    const json = await resp.json();
    if (json.error && json.detail) {
      return `${json.error}: ${json.detail}`;
    }
    return json.error || json.detail || JSON.stringify(json);
  } catch {
    return null;
  }
}

function formatError(err, apiBase) {
  const msg = err?.message || "Unknown error";

  if (msg === "Failed to fetch" || msg === "Load failed") {
    if (window.location.protocol === "https:" && apiBase.startsWith("http://")) {
      return "Browser blocked mixed content: frontend is HTTPS but API is HTTP. Use an HTTPS backend URL.";
    }
    return "Cannot reach backend. Check API URL, ensure backend is running, and verify CORS/network.";
  }

  if (msg === "The operation was aborted.") {
    return "Health check timed out. Backend is not responding at the API URL.";
  }

  return msg;
}

function setDownloadState(url) {
  if (!url) {
    downloadLink.removeAttribute("href");
    downloadLink.setAttribute("aria-disabled", "true");
    return;
  }

  downloadLink.href = url;
  downloadLink.removeAttribute("aria-disabled");
}
