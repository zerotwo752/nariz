import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";
import { useSearchParams } from "react-router-dom";
const API = import.meta.env.VITE_API_URL;
const FRONT_URL = import.meta.env.VITE_FRONT_URL;

export default function Cuenta() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);

  const [trc20, setTrc20] = useState("");
  const [bep20, setBep20] = useState("");
  const [yape, setYape] = useState(""); // Nuevo estado para Yape
  const [plin, setPlin] = useState(""); // Nuevo estado para Plin

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    axios
      .get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) {
          setUser(res.data.user);
          setTrc20(res.data.user.trc20_address || "");
          setBep20(res.data.user.bep20_address || "");
          setYape(res.data.user.yape_address || ""); // Cargar dirección Yape
          setPlin(res.data.user.plin_address || ""); // Cargar dirección Plin
        }
      })
      .catch(() => {
        setMsg("❌ Error cargando datos del usuario");
      });
  }, []);

  async function handleSave() {
    try {
      setLoading(true);
      setMsg(null);
  
      console.log("Datos a enviar al backend:", { trc20, bep20, yape, plin }); // Log de los datos antes de enviarlos
  
      const token = getToken();
  
      const response = await axios.post(
        `${API}/wallets`,
        {
          trc20: trc20 || null,
          bep20: bep20 || null,
          yape: yape || null,
          plin: plin || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      // Verifica si la respuesta tiene éxito y luego maneja el resultado
      if (response.data.success) {
        setMsg("✅ Direcciones guardadas correctamente");
      } else {
        setMsg("❌ Error al actualizar direcciones");
      }
  
      setLoading(false);
    } catch (err) {
      console.error("Error al guardar las direcciones:", err);
      setMsg("❌ Error al actualizar direcciones");
      setLoading(false);
    }
  }


  if (!user) return <p>Cargando datos...</p>;

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
          <h1 className="text-4xl text-white font-extrabold">👤 Mi Cuenta</h1>
        </div>

        {/* Información de la cuenta */}
        <div className="text-white mb-8">
          <p><b>ID:</b> {user.id}</p>
          <p><b>Usuario:</b> {user.username}</p>
          <p><b>Email:</b> {user.email}</p>
          <p><b>Saldo:</b> 💵 ${user.balance}</p>
        </div>

        {/* Programa de referidos */}
        <h3 className="text-xl text-white font-semibold mb-4">🔗 Programa de referidos</h3>
        <p><b>Tu código:</b> {user.referral_code || "No generado"}</p>

        <p><b>Tu enlace para invitar:</b></p>
        <input
          type="text"
          readOnly
          value={`${window.location.origin}/register?ref=${user.referral_code}`}
          className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}/register?ref=${user.referral_code}`
            );
            alert("🔗 Enlace copiado");
          }}
          className="w-full py-3 px-4 bg-indigo-600 rounded-xl text-white font-semibold hover:bg-indigo-500 transition ease-in-out duration-200"
        >
          📋 Copiar enlace de referido
        </button>

        <hr className="my-6" />

        {/* Cuentas de retiro */}
        <h3 className="text-xl text-white font-semibold mb-4">💳 Cuentas de retiro</h3>
        
        <label className="text-gray-300 mb-2"><b>TRC20 (USDT):</b></label>
        <input
          type="text"
          value={trc20}
          onChange={(e) => setTrc20(e.target.value)}
          placeholder="TU dirección TRC20"
          className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
        />

        <label className="text-gray-300 mb-2"><b>BEP20 (USDT):</b></label>
        <input
          type="text"
          value={bep20}
          onChange={(e) => setBep20(e.target.value)}
          placeholder="TU dirección BEP20"
          className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
        />

        {/* Nuevos campos para Yape y Plin */}
        <label className="text-gray-300 mb-2"><b>Yape (9 dígitos):</b></label>
        <input
          type="text"
          value={yape}
          onChange={(e) => setYape(e.target.value)}
          placeholder="TU número de Yape"
          className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
        />

        <label className="text-gray-300 mb-2"><b>Plin (9 dígitos):</b></label>
        <input
          type="text"
          value={plin}
          onChange={(e) => setPlin(e.target.value)}
          placeholder="TU número de Plin"
          className="w-full p-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
        />

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 px-4 bg-green-600 rounded-xl text-white font-semibold hover:bg-green-500 transition ease-in-out duration-200"
        >
          {loading ? "Guardando..." : "💾 Guardar direcciones"}
        </button>

        {msg && (
          <p className={`mt-4 text-center font-semibold ${msg.startsWith("❌") ? "text-red-500" : "text-green-500"}`}>
            {msg}
          </p>
        )}

        <hr className="my-6" />

        {/* Foto de perfil */}
        <h3 className="text-xl text-white font-semibold mb-4">🖼️ Foto de perfil</h3>
        {user.avatar_url ? (
          <img
            src={`${API}/uploads/${user.avatar_url}`}
            alt="avatar"
            width={120}
            className="mx-auto rounded-full"
          />
        ) : (
          <p className="text-center text-gray-300">Sin foto</p>
        )}
      </div>
    </div>
  );
}
