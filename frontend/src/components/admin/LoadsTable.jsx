import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const LoadsTable = ({
  apiCall,
  showError,
  showSuccess,
  getStatusBadgeColor,
  currentPage,
  setCurrentPage,
  itemsPerPage
}) => {
  const [loads, setLoads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLoads = async (page = 1) => {
    try {
      setLoading(true);
      let endpoint = `/admin/loads?page=${page}&limit=${itemsPerPage}`;

      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter !== 'all') endpoint += `&status=${statusFilter}`;

      const res = await apiCall(endpoint);
      if (res.status === 'success') {
        setLoads(res.data.loads || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch loads:', err);
      showError('Error fetching loads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchLoads(currentPage);
  }, [currentPage]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 border rounded-lg flex flex-col md:flex-row justify-between">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search loads..."
            className="border px-3 py-2 rounded-md"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => fetchLoads(1)}
          className="mt-3 md:mt-0 flex items-center bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Load ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cargo Owner</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loads.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">No loads found</td>
              </tr>
            ) : (
              loads.map((load) => (
                <tr key={load._id}>
                  <td className="px-4 py-3">{load.loadNumber || load._id}</td>
                  <td className="px-4 py-3">{load.cargoOwnerName || '-'}</td>
                  <td className="px-4 py-3">{load.origin || '-'}</td>
                  <td className="px-4 py-3">{load.destination || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(load.status)}`}>
                      {load.status}
                    </span>
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
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            className={`px-3 py-1 text-sm rounded ${
              currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Previous
          </button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            className={`px-3 py-1 text-sm rounded ${
              currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default LoadsTable;
