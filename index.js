const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");

let mainWindow;
let slipstreamProc = null;
let restartTimer = null;
let enabled = false;
let currentDomain = null;

function setProxy() {
  exec(
    `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`
  );

  exec(
    `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /d "socks=127.0.0.1:5201" /f`
  );
}

function unsetProxy() {
  exec(
    `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`
  );
}

function isValidDomain(domain) {
  // no protocol, no port, no path
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);
}

function stopSlipstream({ unsetProxyOnStop = true } = {}) {
  if (restartTimer) {
    clearInterval(restartTimer);
    restartTimer = null;
  }

  if (slipstreamProc) {
    try {
      slipstreamProc.kill();
    } catch {}
    slipstreamProc = null;
  }

  if (unsetProxyOnStop) unsetProxy();
}

async function startSlipstream(domain) {
  const exePath = path.join(__dirname, "slipstream-client-windows-amd64.exe");

  slipstreamProc = spawn(
    exePath,
    [
      "--resolver",
      "8.8.8.8:53",
      "--domain",
      domain, // <-- use passed domain
    ],
    { windowsHide: true }
  );

  slipstreamProc.stdout.on("data", (data) => {
    mainWindow?.webContents.send("log", data.toString());
  });

  slipstreamProc.stderr.on("data", (data) => {
    mainWindow?.webContents.send("log", "[ERR] " + data.toString());
  });

  slipstreamProc.on("exit", () => {
    slipstreamProc = null;

    // if user disabled it, we stop fully
    if (!enabled) {
      unsetProxy();
      mainWindow?.webContents.send("status", false);
      return;
    }

    // if enabled, let the restart timer bring it back
    mainWindow?.webContents.send("log", "[WARN] Slipstream exited, waiting for restart...");
  });

  // give it a moment to bind 5201
  await new Promise((r) => setTimeout(r, 1000));

  setProxy();
  mainWindow?.webContents.send("status", true);
}

function scheduleAutoRestart() {
  if (restartTimer) clearInterval(restartTimer);

  restartTimer = setInterval(async () => {
    if (!enabled) return;

    mainWindow?.webContents.send("log", "[INFO] Auto-restarting Slipstream...");

    // kill current process (do NOT unset proxy)
    if (slipstreamProc) {
      try {
        slipstreamProc.kill();
      } catch {}
      slipstreamProc = null;
    }

    // restart
    try {
      await startSlipstream(currentDomain);
    } catch (e) {
      mainWindow?.webContents.send("log", "[ERR] Restart failed: " + String(e));
    }
  }, 30_000);
}

ipcMain.handle("enable", async (_, domain) => {
  if (enabled) return true;

  if (!isValidDomain(domain)) {
    mainWindow.webContents.send("error", "Invalid domain name");
    return false;
  }

  enabled = true;
  currentDomain = domain;

  await startSlipstream(domain);
  scheduleAutoRestart();

  return true;
});

ipcMain.handle("disable", async () => {
  enabled = false;
  currentDomain = null;

  stopSlipstream({ unsetProxyOnStop: true });

  mainWindow?.webContents.send("status", false);
  return true;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("renderer.html");
}

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  enabled = false;
  stopSlipstream({ unsetProxyOnStop: true });
});
