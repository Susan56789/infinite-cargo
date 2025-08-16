// components/admin/SubscriptionsTable.jsx
import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, RefreshCw } from "lucide-react";

const SubscriptionsTable = ({
  apiCall,
  showSuccess,
  showError,
  formatCurrency,
  currentPage,
  setCurrentPage,
  itemsPerPage
}) => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  const fetchSubscriptions = async (page = 1) => {
    try {
      setLoading(true);
      let endpoint = `/subscriptions/admin/pending?page=${page}&limit=${itemsPerPage}`;

      // If filtering by other status
      if (statusFilter !== 'pending') {
        endpoint = `/subscriptions/admin/pending?page=${page}&limit=${itemsPerPage}&status=${statusFilter}`;
      }

      if (searchTerm) {
        endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await apiCall(endpoint);
      if (response.status === 'success') {
        setSubscriptions(response.data.subscriptions || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
      showError('Error fetching subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchSubscriptions(currentPage);
  }, [currentPage]);

  const handleApprove = async (subId) => {
    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${subId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ paymentVerified: true })
      });
      if (response.status === 'success') {
        showSuccess('Subscription approved');
        fetchSubscriptions(1);
      }
    } catch (err) {
      console.error('Failed to approve:', err);
      showError('Error approving subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (subId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${subId}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          reasonCategory: 'other',
          refundRequired: false
        })
      });
      if (response.status === 'success') {
        showSuccess('Subscription rejected');
        fetchSubscriptions(1);
      }
    } catch (err) {
      console.error('Failed to reject:', err);
      showError('Error rejecting subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="border px-3 py-2 rounded-md"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <button
          onClick={() => fetchSubscriptions(1)}
          className="flex items-center bg-gray-200 text-gray-700 rounded-lg px-3 py-2 mt-3 md:mt-0"
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
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-4 text-center text-gray-500">No subscriptions found.</td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub._id}>
                  <td className="px-4 py-3">{sub.user?.name || 'N/A'}</td>
                  <td className="px-4 py-3">{sub.planName}</td>
                  <td className="px-4 py-3">{formatCurrency(sub.price)}</td>
                  <td className="px-4 py-3 capitalize">{sub.status}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {sub.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(sub._id)}
                          className="inline-flex items-center bg-green-200 text-green-700 px-2 py-1 text-xs rounded hover:bg-green-300"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleReject(sub._id)}
                          className="inline-flex items-center bg-red-200 text-red-700 px-2 py-1 text-xs rounded hover:bg-red-300"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
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
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            className={`px-3 py-1 text-sm rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            className={`px-3 py-1 text-sm rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsTable;
