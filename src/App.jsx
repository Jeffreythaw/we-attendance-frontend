import React from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./screens/Login";
import EmployeeMobileShell from "./layouts/EmployeeMobileShell";
import AdminDesktopShell from "./layouts/AdminDesktopShell";
import SupervisorDesktopShell from "./layouts/SupervisorDesktopShell";
import ThemeProvider from "./theme/ThemeProvider";

function AuthedApp({ user, logout }) {
  const role = (user?.role || "").toLowerCase();
  if (role === "admin") return <AdminDesktopShell user={user} logout={logout} />;
  if (role === "supervisor") return <SupervisorDesktopShell user={user} logout={logout} />;
  return <EmployeeMobileShell user={user} logout={logout} />;
}

export default function App() {
  const { user, isAuthed, login, logout } = useAuth();

  return (
    <ThemeProvider>
      {!isAuthed ? <Login onLogin={login} /> : <AuthedApp key={`${user?.username || "u"}:${user?.role || "r"}`} user={user} logout={logout} />}
    </ThemeProvider>
  );
}
