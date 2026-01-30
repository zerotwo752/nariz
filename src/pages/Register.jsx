import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await axios.post(
        `${API}/register`,
        {
          username,
          email,
          password,
          referral_code_used: referralCode || null,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (res.data.success) {
        setMessage("✔ Registro exitoso! Ahora inicia sesión.");
        setUsername("");
        setEmail("");
        setPassword("");
        setReferralCode("");
      } else {
        setMessage("❌ Error: " + res.data.error);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error del servidor");
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0e0e0e",
        color: "white",
      }}
    >
      <div
        style={{
          padding: 25,
          width: "100%",
          maxWidth: 420,
          background: "#151515",
          borderRadius: 12,
          boxShadow: "0 0 25px rgba(0,0,0,.6)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src="/ratitos.jpg"
            alt="Logo RATITO"
            style={{
              maxWidth: "200px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          />
          <h2 style={{ textAlign: "center", marginBottom: 10 }}>📝 Crear cuenta</h2>
        </div>

        <form
          onSubmit={handleRegister}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 10,
          }}
        >
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              padding: 10,
              background: "#1f1f1f",
              border: "1px solid #333",
              color: "white",
              borderRadius: 6,
            }}
          />

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: 10,
              background: "#1f1f1f",
              border: "1px solid #333",
              color: "white",
              borderRadius: 6,
            }}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: 10,
              background: "#1f1f1f",
              border: "1px solid #333",
              color: "white",
              borderRadius: 6,
            }}
          />

          <input
            type="text"
            placeholder="Código de referido"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            required
            style={{
              padding: 10,
              background: "#1f1f1f",
              border: "1px solid #333",
              color: "white",
              borderRadius: 6,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 5,
              padding: "10px 20px",
              background: loading ? "#444" : "#007bff",
              border: "none",
              color: "white",
              fontWeight: "bold",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>
        </form>

        <button
          onClick={() => navigate("/login")}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 20px",
            background: "#222",
            border: "1px solid #444",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          👉 Ya tengo cuenta — Iniciar sesión
        </button>

        {message && (
          <p
            style={{
              marginTop: 15,
              textAlign: "center",
              background: "#101010",
              padding: 10,
              borderRadius: 8,
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

