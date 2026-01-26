const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const domainInput = document.getElementById("domain");

let state = "off"; // off | connecting | on

function setState(next) {
  state = next;
  toggle.className = `toggle ${next}`;

  if (next === "off") {
    status.textContent = "Proxy Disabled";
    status.className = "status off";
  }

  if (next === "connecting") {
    status.textContent = "Connecting…";
    status.className = "status";
  }

  if (next === "on") {
    status.textContent = "Proxy Enabled";
    status.className = "status on";
  }
}

toggle.onclick = async () => {
if (state === "off") {
  const domain = domainInput.value.trim();

  if (!domain) {
    alert("Please enter a domain");
    return;
  }

  setState("connecting");

  const ok = await window.api.enable(domain);
  if (!ok) {
    setState("off");
  } else {
    setState("on");
  }
}

};

// window.api.onError((msg) => {
//   alert(msg); // replaced later with toast if you want
//   setState("off");
// });
const logsEl = document.getElementById("logs");
const MAX_LINES = 300;
function appendLog(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    logsEl.textContent += line + "\n";
  }

  const all = logsEl.textContent.split("\n");
  if (all.length > MAX_LINES) {
    logsEl.textContent = all.slice(-MAX_LINES).join("\n");
  }

  logsEl.scrollTop = logsEl.scrollHeight;
}
window.api.onLog(appendLog);
