export default function manifest() {
  return {
    name: "Tactyqal Labs",
    short_name: "Tactyqal",
    description: "From idea to launched app, in 8 weeks. 1:1 mentoring for young builders.",
    start_url: "/",
    display: "standalone",
    background_color: "#EBEBD8",
    theme_color: "#455230",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
