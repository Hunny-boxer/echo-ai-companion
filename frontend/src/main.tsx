import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import AuthGate from "./AuthGate";
import "./styles.css";

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
