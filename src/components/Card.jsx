// src/components/Card.jsx
export function Card({ children, className = "", style }) {
  return (
    <div className={`we-card ${className}`} style={style}>
      {children}
    </div>
  );
}