const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");

let mainWindow;
let slipstreamProc = null;

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
ipcMain.handle("enable", async (_,domain) => {
  if (slipstreamProc) return;
 if (!isValidDomain(domain)) {
    mainWindow.webContents.send(
      "error",
      "Invalid domain name"
    );
    return false;
  }
  const exePath = path.join(
    __dirname,
    "slipstream-client-windows-amd64.exe"
  );

  slipstreamProc = spawn(exePath, [
    "--resolver",
    "8.8.8.8:53",
    "--domain",
    "f.hafezsho.com"
  ], {
    windowsHide: true
  });
slipstreamProc.stdout.on("data", (data) => {
  console.log(data.toString(),'data')
  mainWindow.webContents.send("log", data.toString());
});

slipstreamProc.stderr.on("data", (data) => {
  console.log(data.toString(),'err')
  mainWindow.webContents.send("log", "[ERR] " + data.toString());
});
  slipstreamProc.on("exit", () => {
    slipstreamProc = null;
    unsetProxy();
    mainWindow.webContents.send("status", false);
  });

  // give it a moment to bind 5201
  await new Promise(r => setTimeout(r, 1000));

  setProxy();
  return true;
});

ipcMain.handle("disable", async () => {
  if (slipstreamProc) {
    slipstreamProc.kill();
    slipstreamProc = null;
  }

  unsetProxy();
  return true;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile("renderer.html");
}

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  if (slipstreamProc) slipstreamProc.kill();
  unsetProxy();
});
