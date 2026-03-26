import { createRoot } from "react-dom/client";
import ChatWidget from "./components/ChatWidget";
import "./index.css";

// Check if we're on the admin page
const isAdminRoute = window.location.pathname.startsWith("/admin");

if (isAdminRoute) {
  // Full React app for admin
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.style.display = "block";
    import("./App").then(({ default: App }) => {
      createRoot(rootEl).render(<App />);
    });
  }
} else {
  // Static page — just mount the chat widget
  const chatRoot = document.getElementById("chat-widget-root");
  if (chatRoot) {
    createRoot(chatRoot).render(<ChatWidget />);
  }
}
