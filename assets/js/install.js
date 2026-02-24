if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then(
    (registration) => {
      console.log("✅ Service Worker enregistré :", registration.scope);
    },
    (error) => {
      console.error("❌ Service Worker non enregistré :", error);
    }
  );
}

let deferredPrompt;
const installButton = document.getElementById("installButton");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installButton.style.display = "block";
});

installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;

  console.log(choice.outcome === "accepted"
    ? "📱 App installée"
    : "❌ Installation refusée"
  );

  deferredPrompt = null;
  installButton.style.display = "none";
});

window.addEventListener("appinstalled", () => {
  console.log("🎉 PWA installée avec succès !");
});
