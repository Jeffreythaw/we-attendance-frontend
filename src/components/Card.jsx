import React from "react";

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        border: "1px solid rgba(15,23,42,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}