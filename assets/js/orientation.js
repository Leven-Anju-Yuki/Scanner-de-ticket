// Le manifeste demande le paysage à l'installation. En navigateur, un geste
// utilisateur est requis pour tenter le verrouillage ; sinon la rotation reste manuelle.
const landscapeButton = document.getElementById("enterLandscape");
landscapeButton.addEventListener("click", async () => {
  const help = document.getElementById("orientationHelp");
  landscapeButton.disabled = true;
  let enteredFullscreen = false;
  try {
    if (!screen.orientation?.lock) throw Error("unsupported");
    try { await screen.orientation.lock("landscape"); }
    catch (_) {
      if (!document.documentElement.requestFullscreen) throw Error("unsupported");
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen(); enteredFullscreen = true;
      }
      await screen.orientation.lock("landscape");
    }
    help.textContent = "Mode paysage activé.";
  } catch (_) {
    if (enteredFullscreen && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (_) {}
    }
    help.textContent = "Ce navigateur demande une rotation manuelle : active la rotation automatique puis tourne ton téléphone à l’horizontale.";
  } finally { landscapeButton.disabled = false; }
});
