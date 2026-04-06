"use client";
import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Check } from "lucide-react";

 const firebaseConfig = {
    apiKey: "AIzaSyByCljkhbeRresL9AhxYPPudLtNKVZcPEg",
    authDomain: "planner-jobs.firebaseapp.com",
    projectId: "planner-jobs",
    storageBucket: "planner-jobs.firebasestorage.app",
    messagingSenderId: "24444476840",
    appId: "1:24444476840:web:6a98df14dd95100f7a119d",
    measurementId: "G-XXWJDYH9DR"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const priorities = {
  PNLD: { label: "PNLD", style: "bg-red-100 text-red-600" },
  MERCADO: { label: "Mercado", style: "bg-gray-200 text-gray-600" },
};

const operators = ["Felipe", "Sol"];

const formatDateBR = (date) => {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
};

// 🔧 helper para garantir formato YYYY-MM-DD sem timezone
const toISODateLocal = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function Planner() {
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState("PNLD");
  const [filter, setFilter] = useState("Todos");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "jobs"), (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // 🔧 FIX: se não houver data selecionada (primeira inserção), usa HOJE
  const addJob = async () => {
    if (!title) return;

    const safeDate = date && date.length === 10 ? date : toISODateLocal(new Date());

    await addDoc(collection(db, "jobs"), {
      title,
      date: safeDate,
      priority,
      status: "",
      operator: "",
      createdAt: Date.now(), // ajuda ordenação consistente
    });

    setTitle("");
    setDate("");
  };

  const updateJob = async (id, field, value) => {
    let updateData = { [field]: value };
    if (field === "operator" && value) updateData.status = "Iniciado";
    await updateDoc(doc(db, "jobs", id), updateData);
  };

  const toggleDone = async (job) => {
    const newStatus = job.status === "Finalizado" ? "Iniciado" : "Finalizado";
    await updateDoc(doc(db, "jobs", job.id), { status: newStatus });
  };

  const removeJob = async (id) => {
    await deleteDoc(doc(db, "jobs", id));
  };

  const isLate = (jobDate) => {
    const today = toISODateLocal(new Date());
    return jobDate < today;
  };

  const getWeekDays = () => {
    const today = new Date();
    const start = new Date(today.setDate(today.getDate() - today.getDay()));

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return toISODateLocal(d);
    });
  };

  const weekDays = getWeekDays();

  const handleDrop = (e, day) => {
    const id = e.dataTransfer.getData("id");
    if (id) updateJob(id, "date", day);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" className="h-10" />
          <h1 className="text-xl font-semibold text-gray-800">Planner Semanal</h1>
        </div>

        {/* FILTRO */}
        <select
          className="border rounded-lg p-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>Todos</option>
          {operators.map(op => <option key={op}>{op}</option>)}
        </select>
      </div>

      {/* FORM */}
      <div className="bg-white rounded-xl p-4 mb-6 flex gap-2 shadow-sm border">
        <input
          className="border p-2 flex-1 rounded-lg"
          placeholder="Nome do trabalho"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          className="border p-2 rounded-lg"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          className="border p-2 rounded-lg"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="PNLD">PNLD</option>
          <option value="MERCADO">Mercado</option>
        </select>
        <button className="bg-gray-900 text-white px-4 rounded-lg" onClick={addJob}>
          +
        </button>
      </div>

      {/* BOARD */}
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map(day => {
          const dayJobs = jobs
            .filter(j => j.date === day)
            .filter(j => filter === "Todos" || j.operator === filter);

          return (
            <div
              key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, day)}
              className="bg-white rounded-2xl p-3 shadow-sm border"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  {formatDateBR(day)}
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-blue-100 text-blue-600 font-semibold">
                  {dayJobs.length}
                </span>
              </div>

              <div className="space-y-3">
                {dayJobs
                  .sort((a, b) => {
                    if (a.status === "Finalizado") return 1;
                    if (b.status === "Finalizado") return -1;
                    if (a.priority === "PNLD") return -1;
                    if (b.priority === "PNLD") return 1;
                    return (a.createdAt || 0) - (b.createdAt || 0);
                  })
                  .map(job => {
                    const isDone = job.status === "Finalizado";
                    const late = isLate(job.date) && !isDone;

                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("id", job.id)}
                        className={`rounded-xl p-3 transition-all cursor-move border
                          ${isDone ? "bg-gray-100 opacity-60" : "bg-white hover:shadow-md"}
                          ${late ? "border-red-400" : "border-gray-200"}`}
                      >
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-bold tracking-tight">
                            {job.title}
                          </p>

                          <button onClick={() => toggleDone(job)}>
                            <Check
                              size={18}
                              className={isDone ? "text-green-600" : "text-gray-300"}
                            />
                          </button>
                        </div>

                        <div className="mt-2">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${priorities[job.priority].style}`}>
                            {job.priority}
                          </span>
                        </div>

                        <select
                          className="text-xs mt-2 w-full border rounded-md p-1"
                          value={job.operator}
                          onChange={(e) => updateJob(job.id, "operator", e.target.value)}
                        >
                          <option value="">Selecionar operador</option>
                          {operators.map(op => (
                            <option key={op}>{op}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => removeJob(job.id)}
                          className="text-xs text-red-400 hover:text-red-600 mt-2"
                        >
                          remover
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
