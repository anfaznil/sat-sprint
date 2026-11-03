import type { MetadataRoute } from "next";

// Lets "Add to Home Screen" install SAT Sprint as a full-screen app with its own icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SAT Sprint",
    short_name: "SAT Sprint",
    description: "Daily SAT practice for Dec 5.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6fb",
    theme_color: "#5b4bdb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
