const MAX_BYTES = 10 * 1024 * 1024; // 10 MB PDF limit for now

const app = document.getElementById("app");
const wrap = document.getElementById("output-wrap");
const output = document.getElementById("output");
const startStatus = document.getElementById("start-status");
const input = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const attachBtn = document.getElementById("attach");
const fileInput = document.getElementById("pdf");
const chip = document.getElementById("chip");
const chipName = document.getElementById("chip-name");
const chipRemove = document.getElementById("chip-remove");

let attached = null;
let busy = false;

/* ---------- tiny markdown to HTML converter ---------- */

function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Escapes first, then adds tags, so the AI's text can never inject HTML.
function inline(s) {
  return escapeHTML(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const lists = []; // currently open lists, innermost last
  let html = "";
  let inCode = false;

  const closeLists = (toIndent = -1) => {
    while (lists.length && lists[lists.length - 1].indent > toIndent) {
      html += `</li></${lists.pop().tag}>`;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html += "</code></pre>";
        inCode = false;
      } else {
        closeLists();
        html += "<pre><code>";
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      html += escapeHTML(line) + "\n";
      continue;
    }
    if (!line.trim()) {
      closeLists();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeLists();
      const n = heading[1].length;
      html += `<h${n}>${inline(heading[2])}</h${n}>`;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeLists();
      html += "<hr>";
      continue;
    }

    const item = line.match(/^(\s*)([*+-]|\d+[.)])\s+(.*)$/);
    if (item) {
      const indent = item[1].length;
      const tag = /\d/.test(item[2]) ? "ol" : "ul";
      const text = inline(item[3]);
      const top = lists[lists.length - 1];
      if (!top || indent > top.indent) {
        const start = tag === "ol" ? ` start="${parseInt(item[2], 10)}"` : "";
        html += `<${tag}${start}><li>${text}`;
        lists.push({ indent, tag });
      } else {
        closeLists(indent);
        const now = lists[lists.length - 1];
        if (now && now.indent === indent) {
          html += `</li><li>${text}`;
        } else {
          html += `<${tag}><li>${text}`;
          lists.push({ indent, tag });
        }
      }
      continue;
    }

    if (lists.length && /^\s+\S/.test(line)) {
      html += " " + inline(line.trim()); // wrapped continuation of a bullet
      continue;
    }

    closeLists();
    html += `<p>${inline(line)}</p>`;
  }

  if (inCode) html += "</code></pre>";
  closeLists();
  return html;
}

/* ---------- UI helpers ---------- */

const loadingHTML = (label) =>
  `<div class="loading"><span>${label}</span><span class="dots"><i></i><i></i><i></i></span></div>`;

// On the start screen the status sits under the box. After that it replaces the answer area.
function showStatus(html) {
  if (app.classList.contains("start")) startStatus.innerHTML = html;
  else output.innerHTML = html;
}

function setBusy(value) {
  busy = value;
  sendBtn.disabled = value;
  attachBtn.disabled = value;
  chipRemove.disabled = value;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clearAttachment() {
  attached = null;
  fileInput.value = ""; // lets you pick the same file again later
  chip.hidden = true;
}

/* ---------- events ---------- */

attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (file.size > MAX_BYTES) {
    clearAttachment();
    showStatus(`<p class="error">That file is over 10 MB. Try a smaller one.</p>`);
    return;
  }
  attached = file;
  chipName.textContent = file.name;
  chip.hidden = false;
  startStatus.innerHTML = "";
});

chipRemove.addEventListener("click", clearAttachment);

async function submit() {
  if (busy) return;
  const text = input.value.trim();
  if (!text && !attached) return;

  setBusy(true);
  showStatus(loadingHTML(attached ? "Reading your PDF" : "Thinking"));

  try {
    const pdf = attached ? await fileToBase64(attached) : null;
    const result = await window.api.askAI({ prompt: text, pdf });

    if (result && result.ok) {
      app.classList.replace("start", "chat");
      startStatus.innerHTML = "";
      output.innerHTML = renderMarkdown(result.text);
      wrap.scrollTop = 0;
      input.value = "";
      clearAttachment(); 
    } else {
      showStatus(`<p class="error">${escapeHTML(result.error)}</p>`);
    }
  } catch (err) {
    showStatus(`<p class="error">${escapeHTML(err.message)}</p>`);
  } finally {
    setBusy(false);
    input.focus();
  }
}

sendBtn.addEventListener("click", submit);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit();
  }
});

input.focus();