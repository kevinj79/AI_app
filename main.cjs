require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const MODEL = "gemini-3.1-flash-lite"; // keep the one that worked for you

const STUDY_RULES =
  "You are a study assistant. Base your answer on the attached document and don't add information that isn't in it. Unless the user asks for a different format, use clear headers and bullet points.";

async function callGemini(parts) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({ contents: [{ parts }] }),
        signal: AbortSignal.timeout(120000),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: `Error ${res.status}: ${data.error?.message ?? "unknown"}` };
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    return text ? { ok: true, text } : { ok: false, error: "The AI returned no text." };
  } catch (err) {
    return {
      ok: false,
      error: err.name === "TimeoutError" ? "The request timed out. Try again." : `Network error: ${err.message}`,
    };
  }
}

ipcMain.handle("ask-ai", (event, { prompt, pdf }) => {
  const parts = [];
  if (pdf) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdf } });
    parts.push({
      text: `${STUDY_RULES}\n\n${prompt ? `User's request: ${prompt}` : "Summarize this document."}`,
    });
  } else {
    parts.push({ text: prompt });
  }
  return callGemini(parts);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 380,
    minHeight: 420,
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});