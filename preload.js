const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
enable: (domain) => ipcRenderer.invoke("enable", domain),
  disable: () => ipcRenderer.invoke("disable"),
  onStatus: (cb) => ipcRenderer.on("status", (_, s) => cb(s))
});
