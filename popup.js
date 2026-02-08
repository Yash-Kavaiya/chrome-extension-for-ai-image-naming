document.addEventListener("DOMContentLoaded", async () => {
  const enableToggle = document.getElementById("enableToggle");
  const statusText = document.getElementById("statusText");
  const apiKeyInput = document.getElementById("apiKey");
  const toggleVisibility = document.getElementById("toggleVisibility");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const statusMsg = document.getElementById("statusMsg");
  const historyList = document.getElementById("historyList");

  // Load saved settings
  const settings = await chrome.storage.sync.get({ enabled: true, apiKey: "" });
  enableToggle.checked = settings.enabled;
  apiKeyInput.value = settings.apiKey;
  updateStatusText(settings.enabled);

  // Toggle enable/disable
  enableToggle.addEventListener("change", async () => {
    const enabled = enableToggle.checked;
    await chrome.storage.sync.set({ enabled });
    updateStatusText(enabled);
  });

  function updateStatusText(enabled) {
    statusText.textContent = enabled ? "Enabled" : "Disabled";
    statusText.style.color = enabled ? "#1e7e34" : "#999";
  }

  // Toggle API key visibility
  toggleVisibility.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
  });

  // Save API key
  saveBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus("Please enter an API key.", "error");
      return;
    }
    await chrome.storage.sync.set({ apiKey });
    showStatus("API key saved.", "success");
  });

  // Test API key
  testBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus("Please enter an API key first.", "error");
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = "Testing...";

    const result = await chrome.runtime.sendMessage({ type: "testApi", apiKey });

    if (result.success) {
      showStatus("API key is valid.", "success");
    } else {
      showStatus(`Invalid key: ${result.error}`, "error");
    }

    testBtn.disabled = false;
    testBtn.textContent = "Test Key";
  });

  function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = `status-msg ${type}`;
  }

  // Load rename history
  chrome.runtime.sendMessage({ type: "getHistory" }, (history) => {
    if (!history || history.length === 0) return;

    historyList.innerHTML = "";
    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      const ago = timeAgo(item.timestamp);
      div.innerHTML = `
        <div class="original">${escapeHtml(item.original)}</div>
        <div class="renamed">${escapeHtml(item.renamed)}</div>
        <div class="time">${ago}</div>
      `;
      historyList.appendChild(div);
    });
  });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
