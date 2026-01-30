import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const btn = {
    padding: "15px",
    margin: "10px",
    fontSize: "18px",
    width: "220px",
    borderRadius: "10px",
    cursor: "pointer",
    color: "white",
    border: "none",
    fontWeight: "bold",
    transition: "transform 0.2s ease-in-out", // Agregado para efectos al pasar el mouse
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-6">
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
        <h1 className="text-4xl text-white font-extrabold">🏠 Bienvenido a R A T I T O</h1>
      </div>

      {/* Botones de navegación */}
      <div className="flex flex-wrap justify-center gap-6">
        <button
          style={{ ...btn, background: "#3498db" }}
          onClick={() => navigate("/recargas")}
          className="transform hover:scale-105"
        >
          💰 Recargas
        </button>

        <button
          style={{ ...btn, background: "#2ecc71" }}
          onClick={() => navigate("/retiros")}
          className="transform hover:scale-105"
        >
          🏧 Retiros
        </button>

        <button
          style={{ ...btn, background: "#e67e22" }}
          onClick={() => navigate("/apuestas")}
          className="transform hover:scale-105"
        >
          🎲 Apuestas
        </button>

        <button
          style={{ ...btn, background: "#9b59b6" }}
          onClick={() => navigate("/inversion")}
          className="transform hover:scale-105"
        >
          📈 Inversión
        </button>

        <button
          style={{ ...btn, background: "#34495e" }}
          onClick={() => navigate("/cuenta")}
          className="transform hover:scale-105"
        >
          👤 Mi Cuenta
        </button>
      </div>
    </div>
  );
}

