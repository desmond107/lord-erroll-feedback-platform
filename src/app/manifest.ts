import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Lord Erroll · Feedback",
    short_name: "Lord Erroll",
    start_url: "/portal",
    display: "standalone",
    background_color: "#faf5ea",
    theme_color: "#1f5e3a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
