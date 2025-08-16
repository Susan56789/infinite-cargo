import React from 'react';
import { LogOut } from 'lucide-react';

const AdminHeader = ({ name, role, onLogout }) => (
  <div className="bg-white shadow-sm border-b px-6 py-3 flex justify-between items-center mb-6">
    <div>
      <h2 className="text-lg font-semibold">Welcome, {name}</h2>
      <p className="text-sm text-gray-500 capitalize">{role}</p>
    </div>
    <button
      onClick={onLogout}
      className="inline-flex items-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
    >
      <LogOut className="h-4 w-4 mr-2" />
      Logout
    </button>
  </div>
);

export default AdminHeader;
