require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const MODEL = "gemini-3.1-flash-lite";

async function askGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30000),
    }
  );
  const data = await res.json();
  if (!res.ok) return `Error ${res.status}: ${data.error?.message ?? "unknown"}`;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No text in response";
}

ipcMain.handle("ask-ai", (event, prompt) => askGemini(prompt));

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
}); 