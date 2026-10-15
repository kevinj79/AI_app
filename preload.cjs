const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  askAI: (prompt) => ipcRenderer.invoke("ask-ai", prompt),
});