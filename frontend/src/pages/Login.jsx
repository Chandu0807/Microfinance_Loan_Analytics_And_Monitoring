import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errorText } from "../api.js";

export default function Login() {
  const [username, setUsername] = useState("officer");
  const [password, setPassword] = useState("officer123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("username", data.username);
      navigate("/");
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 bg-white rounded-xl shadow p-6">
      <h1 className="text-xl font-semibold mb-1">Borrower Intelligence Platform</h1>
      <p className="text-sm text-slate-500 mb-4">Sign in to continue</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full bg-slate-900 text-white rounded py-2">Sign in</button>
      </form>
      <div className="mt-4 text-xs text-slate-500 space-y-1">
        <p>Demo accounts:</p>
        <p>officer / officer123 (loan officer)</p>
        <p>verifier / verifier123 (field verifier)</p>
        <p>supervisor / supervisor123 (supervisor)</p>
      </div>
    </div>
  );
}
