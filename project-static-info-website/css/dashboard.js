import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function Dashboard() {
  const [proctorData, setProctorData] = useState([]);

  useEffect(() => {
    // Fetch proctor-related data from backend API
    fetch("/api/proctor-data")
      .then((res) => res.json())
      .then((data) => setProctorData(data))
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1">
        <Header title="Proctor Dashboard" />
        <main className="p-6">
          <h2 className="text-2xl font-bold">Active Exams</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proctorData.map((exam, index) => (
              <div key={index} className="p-4 bg-white shadow rounded-lg">
                <h3 className="font-semibold">{exam.examName}</h3>
                <p>Students: {exam.studentCount}</p>
                <button className="mt-2 bg-blue-500 text-white px-4 py-2 rounded">
                  Monitor
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
