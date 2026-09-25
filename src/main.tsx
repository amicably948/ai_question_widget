import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Harness } from "./harness/Harness";
import "./harness/harness.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
