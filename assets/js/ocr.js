const input = document.getElementById("ticketInput");
const debug = document.getElementById("ocrDebug");

input.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  debug.textContent = "Analyse du ticket...";

  const result = await Tesseract.recognize(
    file,
    "fra",
    { logger: m => console.log(m) }
  );

  const text = result.data.text;
  debug.textContent = text;

  const data = parseTicket(text);
  fillForm(data);
});
