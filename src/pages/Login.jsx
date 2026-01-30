import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
const API = import.meta.env.VITE_API_URL;

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    const response = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("token", data.token);

      const decoded = jwtDecode(data.token);

      if (decoded.role === "admin") {
        navigate("/admin/recargas");
      } else {
        navigate("/home");
      }
    } else {
      setMsg("Error: " + data.error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="bg-black bg-opacity-80 p-8 rounded-2xl shadow-lg w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/ratitos.jpg"
            alt="Logo RATITO"
            className="mx-auto mb-4"
            style={{
              maxWidth: "200px",
              borderRadius: "10px",
            }}
          />
          <h2 className="text-3xl text-white font-extrabold mb-4">Iniciar Sesión</h2>
        </div>

        {/* Formulario de inicio de sesión */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 rounded-xl text-white font-semibold hover:bg-indigo-500 transition ease-in-out duration-200"
          >
            Ingresar
          </button>
        </form>

        {/* Mensaje de error */}
        {msg && (
          <p className="mt-4 text-center text-red-500 font-semibold">{msg}</p>
        )}

        {/* Enlace a registrarse */}
        <div className="text-center mt-4">
          <p className="text-gray-300">
            ¿No tienes cuenta?{" "}
            <a
              href="/register"
              className="text-indigo-400 hover:text-indigo-500 font-semibold"
            >
              Regístrate aquí
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
