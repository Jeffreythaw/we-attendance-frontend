import React from "react";
import "./AppBackground.css";

export default function AppBackground() {
  return (
    <div className="we-app-bg" aria-hidden="true">
      <div className="we-app-blob b1" />
      <div className="we-app-blob b2" />
      <div className="we-app-blob b3" />
      <div className="we-app-noise" />
    </div>
  );
}

