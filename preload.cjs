const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  askAI: (payload) => ipcRenderer.invoke("ask-ai", payload),
});