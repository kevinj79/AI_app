document.getElementById("send").addEventListener("click", async () => {
  const out = document.getElementById("output");
  out.textContent = "Thinking...";
  out.textContent = await window.api.askAI(document.getElementById("prompt").value);
});