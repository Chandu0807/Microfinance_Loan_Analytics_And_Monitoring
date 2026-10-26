// One axios instance for the whole app: adds the login token to every request.
import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000" });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// if the token expires, go back to the login page (but not when the login itself fails)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && err.config?.url !== "/auth/login") {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const errorText = (e) => {
  const d = e.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(1).join(".")}: ${x.msg}`).join("; ");
  return d || e.message || "Something went wrong";
};

export const inr = (n) => (n == null ? "-" : "Rs " + Number(n).toLocaleString("en-IN"));
export const pct = (x) => (x == null ? "-" : (x * 100).toFixed(1) + "%");

export default api;
