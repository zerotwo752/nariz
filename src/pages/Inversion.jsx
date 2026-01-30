import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
const API = import.meta.env.VITE_API_URL;

export default function Inversiones() {
  const [monto, setMonto] = useState("");
  const [inversiones, setInversiones] = useState([]);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  // =========================
  // CARGAR INVERSIONES
  // =========================
  const cargarInversiones = async () => {
    try {
      const res = await fetch(`${API}/investments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setInversiones(data);
    } catch (err) {
      console.error(err);
      setError("Error cargando inversiones");
    }
  };

  useEffect(() => {
    cargarInversiones();
  }, []);

  // =========================
  // CREAR INVERSIÓN
  // =========================
  const crearInversion = async () => {
    if (!monto || monto <= 0) return alert("Monto inválido");

    try {
      const res = await fetch(`${API}/investments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: monto }),
      });

      const data = await res.json();

      if (data.success) {
        alert("✅ Inversión creada");
        setMonto("");
        cargarInversiones();
      } else {
        alert(data.error || "Error al crear inversión");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // RECOLECTAR
  // =========================
  const recolectar = async (id) => {
    try {
      const res = await fetch(
        `${API}/investments/${id}/claim`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      alert(`💰 Ganancia: ${data.profit}`);
      cargarInversiones();
    } catch (err) {
      console.error(err);
      alert("Error al recolectar");
    }
  };

  // =========================
  // UTILIDADES
  // =========================
  const horasRestantes = (lastClaimAt) => {
    if (!lastClaimAt) return 24;

    const diff =
      (new Date() - new Date(lastClaimAt)) / (1000 * 60 * 60);

    return Math.max(0, Math.ceil(24 - diff));
  };

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString("es-PE");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-6">
      <div className="bg-black bg-opacity-80 p-8 rounded-2xl shadow-lg w-full max-w-4xl">
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
          <h1 className="text-4xl text-white font-extrabold">📈 Inversiones</h1>
        </div>

        {/* Volver */}
        <button
          onClick={() => navigate("/home")}
          className="text-indigo-500 hover:text-indigo-400 font-semibold mb-6 block"
        >
          ⬅️ Volver al inicio
        </button>

        {/* Crear inversión */}
        <div className="max-w-lg mx-auto mb-6">
          <h2 className="text-2xl text-white mb-4">Crear inversión</h2>
          <input
            type="number"
            placeholder="Monto a invertir"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
          />
          <button
            onClick={crearInversion}
            className="w-full py-3 px-4 bg-indigo-600 rounded-xl text-white font-semibold hover:bg-indigo-500 transition ease-in-out duration-200"
          >
            Invertir
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-center text-red-500 font-semibold mb-6">
            ❌ {error}
          </p>
        )}

        {/* Mis inversiones */}
        <h2 className="text-2xl text-white mb-4">📋 Mis inversiones</h2>

        {/* Inversiones Table */}
        <table className="min-w-full table-auto text-gray-300 bg-gray-800 rounded-xl shadow-md overflow-hidden mb-6">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Monto</th>
              <th className="py-3 px-4">% Diario</th>
              <th className="py-3 px-4">Días</th>
              <th className="py-3 px-4">Inicio</th>
              <th className="py-3 px-4">Finaliza</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Acción</th>
            </tr>
          </thead>
          <tbody>
            {inversiones.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-3 text-center">
                  No tienes inversiones
                </td>
              </tr>
            ) : (
              inversiones.map((i) => {
                const horas = horasRestantes(i.last_claim_at);
                const puedeRecolectar = horas === 0;

                return (
                  <tr key={i.id} className="border-b border-gray-700">
                    <td className="py-3 px-4">{i.id}</td>
                    <td className="py-3 px-4">$ {i.amount}</td>
                    <td className="py-3 px-4">{i.daily_percent}%</td>
                    <td className="py-3 px-4">
                      {i.claimed_days} / {i.duration_days}
                    </td>
                    <td className="py-3 px-4">{formatFecha(i.start_at)}</td>
                    <td className="py-3 px-4">{formatFecha(i.end_at)}</td>
                    <td className="py-3 px-4">{i.status}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => recolectar(i.id)}
                        className={`py-2 px-4 rounded-xl font-semibold text-white ${
                          puedeRecolectar
                            ? "bg-green-600 hover:bg-green-500"
                            : "bg-gray-600"
                        }`}
                        disabled={!puedeRecolectar}
                      >
                        {puedeRecolectar
                          ? "Recolectar 💰"
                          : `Faltan ${horas}h`}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
