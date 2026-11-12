let deferredPrompt;
const installButton = document.getElementById("installButton");
const updateButton = document.getElementById("updateApp");
const help = document.getElementById("installHelp");
const updateStatus = document.getElementById("appUpdateStatus");
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
 let controller = navigator.serviceWorker.controller, pendingRefresh = false, reloading = false, lastCheck = 0;
 const busy = () => document.getElementById("sendToSheet").disabled;
 function safeRefresh(force = false) {
   if (!pendingRefresh || reloading) return;
   const editing = document.activeElement?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
   if (busy() || document.hidden || (editing && !force)) {
     updateButton.textContent = "Actualiser l’application (saisie conservée)";
     updateStatus.textContent = "Nouvelle version prête. Elle s’affichera après ta saisie, ton scan ou ton envoi.";
     return;
   }
   if (typeof CoutureDraft === "undefined" || !CoutureDraft.save()) {
     updateStatus.textContent = "La sauvegarde locale est indisponible. Termine ton envoi avant d’actualiser.";
     return;
   }
   reloading = true;
   location.reload();
 }
 navigator.serviceWorker.addEventListener("controllerchange", () => {
   const previous = controller; controller = navigator.serviceWorker.controller;
   if (!previous || previous === controller) return;
   pendingRefresh = true; safeRefresh();
 });
 const sendButton = document.getElementById("sendToSheet");
 new MutationObserver(() => safeRefresh()).observe(sendButton, { attributes: true, attributeFilter: ["disabled"] });
 document.addEventListener("focusout", () => setTimeout(() => safeRefresh(), 0));
 navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then(registration => {
   updateButton.hidden = false;
   updateButton.textContent = "Vérifier les mises à jour";
   const activateWaiting = () => { if (registration.waiting) registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" }); };
   registration.addEventListener("updatefound", () => {
     const worker = registration.installing;
     worker?.addEventListener("statechange", () => { if (worker.state === "installed") activateWaiting(); });
   });
   async function check(force = false) {
     if (!navigator.onLine || (!force && Date.now() - lastCheck < 60000)) return;
     lastCheck = Date.now();
     try {
       if (force) updateStatus.textContent = "Recherche de la dernière version…";
       await registration.update(); activateWaiting();
       if (pendingRefresh) safeRefresh(force);
       else if (force) updateStatus.textContent = registration.installing || registration.waiting ? "Nouvelle version en cours de téléchargement…" : "Application à jour.";
     } catch (_) { if (force) updateStatus.textContent = "Vérification impossible pour le moment. Réessaie avec une connexion Internet."; }
   }
   updateButton.onclick = () => { if (pendingRefresh) safeRefresh(true); else check(true); };
   document.addEventListener("visibilitychange", () => { if (!document.hidden) { safeRefresh(); check(); } });
   window.addEventListener("online", () => check());
   window.addEventListener("focus", () => check());
   activateWaiting(); check();
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
