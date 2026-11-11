let deferredPrompt;
const installButton = document.getElementById("installButton");
const updateButton = document.getElementById("updateApp");
const help = document.getElementById("installHelp");
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (!standalone()) help.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent)
  ? "Pour installer : Partager → Sur l’écran d’accueil dans Safari."
  : "Tu peux installer l’application depuis le menu de ton navigateur : Installer l’application ou Ajouter à l’écran d’accueil.";
function networkStatus() {
  document.getElementById("networkStatus").textContent = navigator.onLine ? "" :
    "Hors connexion : ta saisie reste disponible. Le scan, la connexion Google et l’envoi vers Sheets nécessitent Internet.";
}
window.addEventListener("online", networkStatus);
window.addEventListener("offline", networkStatus);
networkStatus();
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) location.reload();
  });
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then(registration => {
    const offerUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;
      updateButton.hidden = false;
      updateButton.onclick = () => {
        if (document.getElementById("sendToSheet").disabled) return;
        if (typeof CoutureDraft !== "undefined" && !CoutureDraft.save()) {
          help.textContent = "La sauvegarde locale est indisponible. Termine ton envoi avant d’actualiser.";
          return;
        }
        refreshing = true;
        registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
      };
    };
    offerUpdate();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => { if (worker.state === "installed") offerUpdate(); });
    });
    registration.update().catch(() => {});
  }).catch(() => { help.textContent = "Installation indisponible pour le moment. Tu peux utiliser le site dans ton navigateur."; });
}
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault(); deferredPrompt = event; installButton.style.display = "block";
});
installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt = null; installButton.style.display = "none";
});
window.addEventListener("appinstalled", () => { installButton.style.display = "none"; help.textContent = "Application installée."; });
