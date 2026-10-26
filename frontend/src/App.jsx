import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import NewApplication from "./pages/NewApplication.jsx";
import Applications from "./pages/Applications.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Alerts from "./pages/Alerts.jsx";
import Verification from "./pages/Verification.jsx";

const LINKS = [
  ["/", "New application"],
  ["/applications", "Applications"],
  ["/dashboard", "Portfolio"],
  ["/alerts", "Monitoring & alerts"],
  ["/verification", "Manual verification"],
];

function Protected({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const navigate = useNavigate();
  const logged = !!localStorage.getItem("token");
  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };
  const link = ({ isActive }) =>
    "px-3 py-2 rounded-md text-sm font-medium " + (isActive ? "bg-white text-slate-900" : "text-slate-200 hover:bg-slate-700");

  return (
    <div className="min-h-screen">
      {logged && (
        <header className="bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-2">
            <span className="text-white font-semibold mr-4">Borrower Intelligence</span>
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"} className={link}>
                {label}
              </NavLink>
            ))}
            <span className="ml-auto text-slate-300 text-sm">
              {localStorage.getItem("username")} ({localStorage.getItem("role")})
            </span>
            <button onClick={logout} className="text-sm text-slate-200 underline">
              Log out
            </button>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><NewApplication /></Protected>} />
          <Route path="/applications" element={<Protected><Applications /></Protected>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
          <Route path="/verification" element={<Protected><Verification /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
