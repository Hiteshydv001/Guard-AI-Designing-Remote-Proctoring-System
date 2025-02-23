import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="w-64 bg-gray-800 text-white h-screen p-4">
      <h2 className="text-lg font-bold mb-4">Proctor Panel</h2>
      <ul>
        <li className="mb-2">
          <Link href="/dashboard">
            <span className="cursor-pointer hover:text-gray-400">Dashboard</span>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/students">
            <span className="cursor-pointer hover:text-gray-400">Students</span>
          </Link>
        </li>
        <li className="mb-2">
          <Link href="/settings">
            <span className="cursor-pointer hover:text-gray-400">Settings</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
