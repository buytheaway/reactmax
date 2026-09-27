import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

window.addEventListener("error", (event) => {
  const root = document.getElementById("root");

  if (root) {
    root.innerHTML = `
      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:30px;
        background:#f4f6f8;
        font-family:Arial,sans-serif;
      ">
        <div style="
          max-width:800px;
          width:100%;
          padding:25px;
          border-radius:16px;
          background:white;
          box-shadow:0 10px 40px rgba(0,0,0,.1);
        ">
          <h2 style="margin-top:0;color:#c0392b;">
            Ошибка React
          </h2>
          <pre style="
            white-space:pre-wrap;
            color:#333;
            background:#f7f7f7;
            padding:15px;
            border-radius:10px;
            overflow:auto;
          ">${event.error?.stack || event.message || "Unknown error"}</pre>
        </div>
      </div>
    `;
  }
});

try {
  ReactDOM.createRoot(
    document.getElementById("root")
  ).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  const root = document.getElementById("root");

  root.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:30px;
      background:#f4f6f8;
      font-family:Arial,sans-serif;
    ">
      <div style="
        max-width:800px;
        width:100%;
        padding:25px;
        border-radius:16px;
        background:white;
        box-shadow:0 10px 40px rgba(0,0,0,.1);
      ">
        <h2 style="margin-top:0;color:#c0392b;">
          Ошибка запуска приложения
        </h2>
        <pre style="
          white-space:pre-wrap;
          color:#333;
          background:#f7f7f7;
          padding:15px;
          border-radius:10px;
          overflow:auto;
        ">${error.stack || error.message}</pre>
      </div>
    </div>
  `;
}
