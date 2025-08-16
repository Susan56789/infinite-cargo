import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const DriversTable = ({
  apiCall,
  showError,
  showSuccess,
  getStatusBadgeColor,
  currentPage,
  setCurrentPage,
  itemsPerPage
}) => {
  const [drivers, setDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalPages, setTotalPages] = useState(1);

  const fetchDrivers = async (page = 1) => {
    try {
      let endpoint = `/drivers?page=${page}&limit=${itemsPerPage}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter !== 'all') endpoint += `&status=${statusFilter}`;

      const res = await apiCall(endpoint);
      if (res.status === 'success') {
        const data = Array.isArray(res.data) ? res.data : res.data.drivers || [];
        setDrivers(data);
        setTotalPages(res.data?.pagination?.totalPages || 1);
      }
    } catch (err) {
      showError('Failed to fetch drivers');
    }
  };

  useEffect(() => {
    fetchDrivers(currentPage);
  }, [currentPage, statusFilter]);

  const toggleVerify = async (id, flag) => {
    try {
      const res = await apiCall(`/admin/users/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ verified: flag })
      });
      if (res.status === 'success') {
        showSuccess(flag ? 'Driver verified' : 'Driver unverified');
        fetchDrivers(currentPage);
      }
    } catch {
      showError('Error updating verification');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 border rounded flex justify-between">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchTerm}
            placeholder="Search..."
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-3 py-2 rounded-md"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <button
          onClick={() => fetchDrivers(1)}
          className="flex items-center bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border rounded">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Verified</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center p-4">No records found</td>
              </tr>
            ) : (
              drivers.map((driver) => (
                <tr key={driver._id}>
                  <td className="px-4 py-2">{driver.name}</td>
                  <td className="px-4 py-2">{driver.email}</td>
                  <td className="px-4 py-2">{driver.phone}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(driver.status)}`}>
                      {driver.status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {driver.driverProfile?.verified ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                        Verified
                      </span>
                    ) : (
                      <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                        Not Verified
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2 space-x-1">
                    {/* Verify / Unverify toggle */}
                    {driver.driverProfile?.verified ? (
                      <button
                        onClick={() => toggleVerify(driver._id, false)}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                      >
                        Unverify
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleVerify(driver._id, true)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            className={`px-3 py-1 text-sm rounded ${currentPage === 1 ? 'bg-gray-100' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            className={`px-3 py-1 text-sm rounded ${currentPage === totalPages ? 'bg-gray-100' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DriversTable;
