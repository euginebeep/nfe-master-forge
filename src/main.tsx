import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerGlobalShortcuts } from "./lib/keyboard-shortcuts";

// Register global keyboard shortcuts
registerGlobalShortcuts();

createRoot(document.getElementById("root")!).render(<App />);