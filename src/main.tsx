import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppBoundary from "./AppBoundary";
import "./index.css";
import "./polish.css";
import "./discover.css";
import "./reliability.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </React.StrictMode>,
);
