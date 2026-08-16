import { App } from "@desktop/renderer/App";
import React from "react";
import ReactDOM from "react-dom/client";
import "@desktop/renderer/styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Renderer root element is missing.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
