import React, { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";




const API = import.meta.env.VITE_API_URL;



export default function Apuestas() {
  const [boxes, setBoxes] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [items, setItems] = useState([]);
  const [openResult, setOpenResult] = useState(null);
  const [user, setUser] = useState(null);

  const [isRolling, setIsRolling] = useState(false);
  const [rollItems, setRollItems] = useState([]);
  const [translateX, setTranslateX] = useState(0);
  const [transition, setTransition] = useState("none");




  useEffect(() => {
    const token = getToken();
    if (!token) return;

    axios.get(`${API}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (res.data.success) setUser(res.data.user);
    })
    .catch(() => {});
  }, []);



  // ===========================
  // CARGAR CAJAS
  // ===========================
  useEffect(() => {
    const fetchBoxes = async () => {
      try {
        const res = await axios.get(`${API}/cases`);
        setBoxes(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBoxes();
  }, []);

  // ===========================
  // CARGAR ITEMS DE CAJA
  // ===========================
  const loadItems = async (boxId) => {
    try {
      const res = await axios.get(`${API}/cases/${boxId}/items`);
      setItems(res.data);
      setSelectedBox(boxId);
      setOpenResult(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ===========================
  // ABRIR CAJA
  // ===========================
  const openBox = async () => {

    if (!user) return alert("Debes iniciar sesión primero");
    if (!selectedBox) return alert("Selecciona una caja");

    try {
      setIsRolling(true);
      setOpenResult(null);

      // 1. pedimos resultado real
      const res = await axios.post(`${API}/cases/${selectedBox}/open`, {
        user_id: user.id
      });

      const prize = res.data.drop;

      // 2. Construimos una lista larga: antes — premio — después

      const before = [];
      const after = [];

      // muchos items ANTES del premio
      for (let i = 0; i < 80; i++) {
        before.push(items[Math.floor(Math.random() * items.length)]);
      }

      // muchos items DESPUÉS del premio
      for (let i = 0; i < 50; i++) {
        after.push(items[Math.floor(Math.random() * items.length)]);
      }

      // premio al centro visual
      const longList = [...before, prize, ...after];

      setRollItems(longList);

      // índice del premio
      const index = before.length;


      setRollItems(longList);

      // 3. ancho del item
      const ITEM_WIDTH = 128; // 120 + gaps



      // 5. centro de la línea roja
      const CENTER = 300;

      // 6. distancia total
      const target =
        index * ITEM_WIDTH - CENTER;

      // 7. reiniciar instantáneo al inicio
      setTransition("none");
      setTranslateX(0);

      // pequeño delay para permitir repaint
      setTimeout(() => {
        // 8. animación con desaceleración realista
        setTransition("transform 8s cubic-bezier(0.1, 0.9, 0.1, 1)");
        setTranslateX(-target);
      }, 50);

      // 9. mostrar resultado al terminar animación
      setTimeout(() => {
        setIsRolling(false);
        setOpenResult(res.data);
      }, 8000);

    } catch (err) {
      console.error(err);
      alert("Error al abrir caja");
      setIsRolling(false);
    }
  };






  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8">
        <h1 className="text-4xl font-extrabold text-center mb-2">
          🎰 Sistema de Cajas
        </h1>
        <p className="text-center text-gray-300">
          Abre cajas y gana premios 
        </p>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">

        {/* LISTA DE CAJAS */}
        <div className="bg-gray-800 rounded-2xl p-4 shadow-xl">
          <h2 className="text-xl font-bold mb-3">📦 Cajas disponibles</h2>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {boxes.map((box) => (
              <div
                key={box.id}
                className={`p-3 rounded-xl cursor-pointer transition ${
                  selectedBox === box.id
                    ? "bg-indigo-600"
                    : "bg-gray-900 hover:bg-gray-700"
                }`}
                onClick={() => loadItems(box.id)}
              >
                <div className="flex justify-between">
                  <span className="font-semibold">{box.name}</span>
                  <span className="text-sm text-gray-300">
                    {box.price} coins
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ITEMS DENTRO DE LA CAJA */}
        <div className="bg-gray-800 rounded-2xl p-4 shadow-xl col-span-2">
          <h2 className="text-xl font-bold mb-3">🎁 Items de la caja</h2>

          {!selectedBox && (
            <p className="text-gray-400 text-sm">
              Selecciona una caja para ver sus items...
            </p>
          )}

          {selectedBox && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[260px] overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-900 rounded-xl p-3 shadow border border-gray-700"
                  >
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-gray-300">
                      💰 valor: {item.value}
                    </div>
                    <div className="text-sm text-indigo-400">
                      🎯 probabilidad: {item.probability}%
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={openBox}
                className="mt-4 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition font-bold"
              >
                🔥 Abrir esta caja
              </button>
            </>
          )}

          {/* RESULTADO */}

          {isRolling && (
            <div className="mt-4 border border-yellow-400 rounded-xl overflow-hidden bg-black relative">

              {/* LINEA ROJA GANADORA */}
              <div className="winner-line"></div>

              {/* CARRUSEL DE ITEMS */}
              <div
                className="roll-track"
                style={{
                  transform: `translateX(${translateX}px)`,
                  transition: transition
                }}
              >
                {rollItems.map((it, index) => (
                  <div key={index} className="item-card">
                    <div className="text-sm font-bold">{it.name}</div>
                    <div className="text-xs text-gray-300">
                      💰 {it.value ?? it.total_value ?? 0}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}




          {openResult && (
            <div className="mt-4 p-4 bg-green-900/60 border border-green-600 rounded-xl">
              <h3 className="font-bold mb-1">🎉 ¡Ganaste!</h3>

              <p>
                Item: <b>{openResult.drop?.name}</b>
              </p>

              <p>
                Valor:{" "}
                <b>
                  {openResult.drop?.value ?? openResult.drop?.total_value ?? 0}
                </b>
              </p>

              <p className="text-sm text-gray-300 mt-1">
                Nuevo saldo: <b>{openResult.balance}</b>
              </p>
            </div>
          )}

        </div>
      </div>

      
    </div>
  );
}
