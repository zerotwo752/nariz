import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function Recargas() {
  const [network, setNetwork] = useState("TRC20");
  const trc20 = "TBYvBBarZDBgpqy7mgtFpN9ce6yJckyYRp";
  const bep20 = "0x5c055c9ef2a8d8986aa5dab8cc250162ac5d0de5";
  const yapePlin = "999999999";  // Dirección para YAPE-PLIN

  const [capture, setCapture] = useState(null);
  const [monto, setMonto] = useState("");
  const [operationDigits, setOperationDigits] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!capture) return alert("Debes subir la captura.");
    if (operationDigits.length !== 6)
      return alert("Los últimos 6 dígitos son obligatorios.");

    const token = localStorage.getItem("token");
    if (!token) return alert("Debes iniciar sesión");

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("image", capture);
      formData.append("network", network);
      formData.append("address", 
        network === "TRC20" ? trc20 : 
        network === "BEP20" ? bep20 : yapePlin);  // Selección de dirección según la red
      formData.append("amount", monto);
      formData.append("operationDigits", operationDigits);

      const res = await axios.post(
        `${API}/recargas`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (res.data.success) {
        alert("✅ Recarga enviada correctamente");
        setMonto("");
        setOperationDigits("");
        setCapture(null);
      } else {
        alert("❌ Error al enviar recarga");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0f0f0f",
      }}
    >
      <div
        style={{
          padding: 20,
          width: "100%",
          maxWidth: 480,
          background: "#161616",
          color: "white",
          borderRadius: 12,
          boxShadow: "0 0 25px rgba(0,0,0,.6)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: 10 }}>💸 Recargas yape-plin escribenos "https://t.me/ratito321"(en caso de que tu TxID sea algo como "2cfac3" las letras lo reemplazas con ceros 200003</h2>

        <label>Red:</label>
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          style={{
            display: "block",
            marginBottom: 15,
            width: "100%",
            background: "#222",
            color: "white",
            border: "1px solid #444",
            padding: 8,
          }}
        >
          <option value="TRC20">TRC20</option>
          <option value="BEP20">BEP20</option>
          <option value="YAPE-PLIN">YAPE-PLIN</option> {/* Nueva opción */}
        </select>

        <h4>📌 Dirección USDT</h4>

        <div
          style={{
            background: "#1f1f1f",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #333",
            wordBreak: "break-all",
            fontSize: 13,
          }}
        >
          {network === "TRC20" ? trc20 : network === "BEP20" ? bep20 : yapePlin} {/* Mostrar la dirección correspondiente */}
        </div>

        <h4 style={{ marginTop: 15 }}>📤 Subir captura</h4>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCapture(e.target.files[0])}
          style={{ marginBottom: 10 }}
        />

        <input
          type="number"
          placeholder="Monto en soles"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          style={{
            display: "block",
            marginTop: 10,
            width: "100%",
            padding: 8,
            background: "#222",
            color: "white",
            border: "1px solid #444",
          }}
        />

        <input
          type="text"
          placeholder="Últimos 6 dígitos del N° operación"
          value={operationDigits}
          maxLength={6}
          onChange={(e) => {
            if (/^\d*$/.test(e.target.value)) {
              setOperationDigits(e.target.value);
            }
          }}
          style={{
            display: "block",
            marginTop: 10,
            width: "100%",
            padding: 8,
            background: "#222",
            color: "white",
            border: "1px solid #444",
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            marginTop: 15,
            padding: "10px 20px",
            width: "100%",
            cursor: "pointer",
            background: loading ? "#444" : "#00c46c",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
          }}
        >
          {loading ? "Enviando..." : "Enviar recarga"}
        </button>
      </div>
    </div>
  );
}
