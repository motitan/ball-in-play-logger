(() => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js?v=20260514-2", { scope: "./" });
    } catch (error) {
      console.error("Service worker registration failed", error);
    }
  });
})();
