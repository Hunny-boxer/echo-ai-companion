
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import AuthGate from "./AuthGate";

// Load the original layout first, then the selected companion's theme.
import "./styles.css";
import "./persona-themes.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Echo root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>
);
