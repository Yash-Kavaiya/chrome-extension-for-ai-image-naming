// AI File Namer - Background Service Worker

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];

const NAMING_PROMPT = `You are a file naming assistant. Analyze this image and provide a short, descriptive filename.

Rules:
- Use lowercase letters, numbers, and hyphens only
- Maximum 6 words, keep it concise
- Describe the main subject/content of the image
- If there is readable text in the image (OCR), incorporate the key text into the name
- Do NOT include file extension
- Do NOT include any explanation, just the filename
- Examples: "golden-retriever-park", "react-component-diagram", "invoice-march-2024", "sunset-mountain-lake"

Respond with ONLY the filename, nothing else.`;

// Intercept downloads and suggest AI-generated filenames
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const mime = downloadItem.mime || "";
  const filename = downloadItem.filename || "";

  // Only process image files
  if (!isImageFile(mime, filename)) {
    suggest();
    return;
  }

  // Check settings asynchronously - return true to keep suggest alive
  handleDownloadRename(downloadItem, suggest);
  return true;
});

async function handleDownloadRename(downloadItem, suggest) {
  try {
    const settings = await getSettings();
    if (!settings.enabled || !settings.apiKey) {
      suggest();
      return;
    }

    const url = downloadItem.url;
    const base64Data = await fetchImageAsBase64(url);
    if (!base64Data) {
      suggest();
      return;
    }

    const aiName = await getAIFilename(base64Data.data, base64Data.mimeType, settings.apiKey);
    if (!aiName) {
      suggest();
      return;
    }

    // Get extension from original filename
    const ext = getExtension(downloadItem.filename, downloadItem.mime);
    const newFilename = `${aiName}${ext}`;

    // Log the rename
    logRename(downloadItem.filename, newFilename);

    // Show badge
    chrome.action.setBadgeText({ text: "AI" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);

    suggest({ filename: newFilename });
  } catch (err) {
    console.error("AI File Namer: error processing download", err);
    suggest();
  }
}

// Context menu: right-click an image to download with AI name
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ai-rename-image",
    title: "Download with AI Name",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "ai-rename-image") return;

  const settings = await getSettings();
  if (!settings.apiKey) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);
    return;
  }

  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  try {
    const base64Data = await fetchImageAsBase64(imageUrl);
    if (!base64Data) return;

    const aiName = await getAIFilename(base64Data.data, base64Data.mimeType, settings.apiKey);
    if (!aiName) return;

    const ext = getExtensionFromMime(base64Data.mimeType) || ".png";
    const filename = `${aiName}${ext}`;

    // This download will also go through onDeterminingFilename,
    // but since we already have the name, we set it directly.
    // Store the intended name so onDeterminingFilename can use it.
    pendingContextMenuDownloads.set(imageUrl, filename);

    chrome.downloads.download({
      url: imageUrl,
      filename: filename
    });
  } catch (err) {
    console.error("AI File Namer: context menu error", err);
  }
});

// Track context menu downloads to avoid double-processing
const pendingContextMenuDownloads = new Map();

// --- Gemini API ---

async function getAIFilename(base64Data, mimeType, apiKey) {
  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        },
        {
          text: NAMING_PROMPT
        }
      ]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 50
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    return null;
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  return sanitizeFilename(text.trim());
}

// --- Helpers ---

function isImageFile(mime, filename) {
  if (mime && mime.startsWith("image/")) return true;
  const lower = (filename || "").toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

async function fetchImageAsBase64(url) {
  try {
    // Handle data URLs directly
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return { mimeType: match[1], data: match[2] };
      }
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    const mimeType = blob.type || "image/png";

    // Check size - Gemini limit is 20MB total request
    if (blob.size > 15 * 1024 * 1024) {
      console.warn("AI File Namer: image too large for inline analysis");
      return null;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { mimeType, data: base64 };
  } catch (err) {
    console.error("Failed to fetch image:", err);
    return null;
  }
}

function sanitizeFilename(name) {
  let clean = name.replace(/[`"']/g, "").trim();
  // Remove any file extension the AI might have added
  clean = clean.replace(/\.\w{2,4}$/, "");
  // Replace spaces and underscores with hyphens
  clean = clean.replace(/[\s_]+/g, "-");
  // Keep only alphanumeric and hyphens
  clean = clean.replace(/[^a-z0-9-]/gi, "");
  clean = clean.toLowerCase();
  // Collapse multiple hyphens
  clean = clean.replace(/-{2,}/g, "-");
  // Trim hyphens from edges
  clean = clean.replace(/^-+|-+$/g, "");
  // Limit length
  if (clean.length > 60) clean = clean.substring(0, 60).replace(/-+$/, "");
  return clean || "unnamed-file";
}

function getExtension(filename, mime) {
  const match = (filename || "").match(/(\.\w{2,5})$/);
  if (match) return match[1].toLowerCase();
  return getExtensionFromMime(mime);
}

function getExtensionFromMime(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    "image/tiff": ".tiff"
  };
  return map[mime] || ".png";
}

async function logRename(originalName, newName) {
  const { renameHistory = [] } = await chrome.storage.local.get("renameHistory");
  renameHistory.unshift({
    original: originalName,
    renamed: newName,
    timestamp: Date.now()
  });
  if (renameHistory.length > 50) renameHistory.length = 50;
  await chrome.storage.local.set({ renameHistory });
}

async function getSettings() {
  const defaults = { enabled: true, apiKey: "" };
  return await chrome.storage.sync.get(defaults);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "testApi") {
    testApiKey(message.apiKey).then(sendResponse);
    return true;
  }
  if (message.type === "getHistory") {
    chrome.storage.local.get("renameHistory").then(({ renameHistory = [] }) => {
      sendResponse(renameHistory);
    });
    return true;
  }
});

async function testApiKey(apiKey) {
  try {
    const url = `${GEMINI_API_URL}?key=${apiKey}`;
    const body = {
      contents: [{
        parts: [{ text: "Reply with only the word OK" }]
      }]
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (response.ok) return { success: true };
    const err = await response.text();
    return { success: false, error: `API error ${response.status}: ${err}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
