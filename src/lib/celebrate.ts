// Confetti for finishing a drill or leveling up. Skipped when the device asks for reduced motion.
export async function celebrate(big = false) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#7a6bf0", "#5b4bdb", "#f0a92e", "#3cc4bd", "#ffffff"];
  confetti({ particleCount: big ? 160 : 110, spread: big ? 100 : 75, startVelocity: 38, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
}
