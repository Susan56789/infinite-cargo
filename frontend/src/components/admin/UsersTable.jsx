import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const statuses = ['active', 'on_hold', 'suspended'];

const UsersTable = ({
  apiCall,
  showError,
  showSuccess,
  getStatusBadgeColor,
  currentPage,
  setCurrentPage,
  itemsPerPage
}) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async (page = 1) => {
    try {
      let endpoint = `/admin/users?page=${page}&limit=${itemsPerPage}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter !== 'all') endpoint += `&status=${statusFilter}`;

      const res = await apiCall(endpoint);
      if (res.status === 'success') {
        setUsers(res.data.users || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      showError('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage, statusFilter]);

  const updateStatus = async (userId, newStatus) => {
    try {
      const res = await apiCall(`/admin/users/${userId}/status`, {
        method: 'POST',
        body: JSON.stringify({ newStatus })
      });
      if (res.status === 'success') {
        showSuccess('Status updated');
        fetchUsers(currentPage);
      }
    } catch (err) {
      showError('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 border rounded-lg flex justify-between">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchTerm}
            placeholder="Search users..."
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-3 py-2 rounded-md"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            <option value="all">All Status</option>
            {statuses.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => fetchUsers(1)}
          className="flex items-center bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="5" className="text-center p-4">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u._id}>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.phone}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(u.accountStatus || 'active')}`}>
                    {u.accountStatus || 'active'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={u.accountStatus || 'active'}
                    onChange={(e) => updateStatus(u._id, e.target.value)}
                    className="border px-2 py-1 text-sm rounded"
                  >
                    {statuses.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className={`px-3 py-1 text-sm rounded ${currentPage === 1 ? 'bg-gray-100' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className={`px-3 py-1 text-sm rounded ${currentPage === totalPages ? 'bg-gray-100' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default UsersTable;
