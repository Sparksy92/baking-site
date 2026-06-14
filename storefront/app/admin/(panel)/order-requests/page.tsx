'use client';

import { useEffect, useState } from 'react';
import { Search, Loader2, X, Calendar, MapPin, Phone, Mail, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';

const STATUS_TABS = ['all', 'new', 'reviewed', 'waiting_on_customer', 'confirmed', 'completed', 'cancelled'] as const;

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border border-blue-200',
  reviewed: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  waiting_on_customer: 'bg-amber-100 text-amber-700 border border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  completed: 'bg-green-100 text-green-700 border border-green-200',
  cancelled: 'bg-rose-100 text-rose-700 border border-rose-200',
};

interface OrderRequestItem {
  product_id?: number;
  product_name: string;
  option?: string;
  quantity: number;
  notes?: string;
}

interface OrderRequest {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  preferred_contact_method: string;
  requested_items: OrderRequestItem[];
  desired_date?: string;
  pickup_or_delivery: string;
  allergy_notes?: string;
  special_instructions?: string;
  status: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminOrderRequests() {
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<OrderRequest | null>(null);
  
  // Modal states for editing
  const [editStatus, setEditStatus] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const statusParam = activeTab === 'all' ? '' : `?status=${activeTab}`;
      const data = await api.get<{ order_requests: OrderRequest[] }>(`/api/admin/order-requests${statusParam}`);
      setRequests(data.order_requests || []);
    } catch (err) {
      console.error(err);
      addToast('Failed to load order requests', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = search.trim()
    ? requests.filter((r) =>
        r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        r.customer_email.toLowerCase().includes(search.toLowerCase()) ||
        r.requested_items.some((item) => item.product_name.toLowerCase().includes(search.toLowerCase()))
      )
    : requests;

  function handleOpenRequest(req: OrderRequest) {
    setSelectedRequest(req);
    setEditStatus(req.status);
    setEditAdminNotes(req.admin_notes || '');
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest) return;
    setUpdating(true);
    try {
      const updated = await api.patch<OrderRequest>(`/api/admin/order-requests/${selectedRequest.id}`, {
        status: editStatus,
        admin_notes: editAdminNotes,
      });
      addToast('Order request updated', 'success');
      
      // Update local state
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedRequest(updated);
    } catch (err) {
      console.error(err);
      addToast('Failed to update request', 'error');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Order Requests</h1>
      </div>

      {/* Controls Container */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar hide-scrollbar-on-mobile w-full lg:w-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab ? 'bg-brand text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
              }`}
            >
              {tab.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-80 flex-shrink-0">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search request name, email, item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">ID</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Customer</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Desired Date</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Service</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Requested Items</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-full w-16"></div></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenRequest(req)}
                    className="hover:bg-gray-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">#{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{req.customer_name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{req.customer_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {req.desired_date ? new Date(req.desired_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Flexible'}
                    </td>
                    <td className="px-6 py-4 capitalize text-gray-700 whitespace-nowrap">{req.pickup_or_delivery}</td>
                    <td className="px-6 py-4">
                      <div className="line-clamp-1 text-gray-900 font-medium">
                        {req.requested_items.map((item) => `${item.quantity}x ${item.product_name}`).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`capitalize px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[req.status] || 'bg-gray-100 text-gray-700'}`}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {search ? 'No matching requests found' : 'No order requests yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4 mb-6">
                <div>
                  <span className="text-xs font-bold text-brand uppercase tracking-wider">Order Request Detail</span>
                  <h2 className="text-xl font-bold text-gray-900 mt-1">Request #{selectedRequest.id}</h2>
                </div>
                <button type="button" onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {/* Customer Info Card */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 mb-6">
                <h3 className="font-semibold text-gray-900 text-sm">Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-500 w-24">Name:</span>
                    <span className="font-semibold text-gray-900">{selectedRequest.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    <span className="font-mono text-gray-900">{selectedRequest.customer_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    <span>{selectedRequest.customer_phone || 'None provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-500 w-24">Contact via:</span>
                    <span className="capitalize font-semibold text-brand">{selectedRequest.preferred_contact_method}</span>
                  </div>
                </div>
              </div>

              {/* Order Info Card */}
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-gray-900 text-sm border-b pb-1">Order Details</h3>
                
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700">
                    <Calendar size={14} className="text-gray-500" />
                    <span>Desired: {selectedRequest.desired_date ? new Date(selectedRequest.desired_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Flexible'}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 capitalize">
                    <MapPin size={14} className="text-gray-500" />
                    <span>Service: {selectedRequest.pickup_or_delivery}</span>
                  </div>
                </div>

                {/* Requested Items List */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-semibold text-gray-700 text-xs">Requested Items</div>
                  <div className="divide-y divide-gray-100 bg-white">
                    {selectedRequest.requested_items.map((item, index) => (
                      <div key={index} className="p-4 flex justify-between gap-4">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{item.product_name}</div>
                          {item.option && <div className="text-xs text-brand font-medium mt-0.5">Option: {item.option}</div>}
                          {item.notes && (
                            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded p-1.5 mt-2 flex items-start gap-1">
                              <FileText size={12} className="mt-0.5 text-gray-400" />
                              <span>{item.notes}</span>
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-gray-900 text-sm flex-shrink-0">x {item.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allergy / Special Notes */}
                {selectedRequest.allergy_notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs">
                    <div className="font-bold mb-1">⚠️ Allergy Notes:</div>
                    <p>{selectedRequest.allergy_notes}</p>
                  </div>
                )}

                {selectedRequest.special_instructions && (
                  <div className="p-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg text-xs">
                    <div className="font-bold mb-1">Special Instructions:</div>
                    <p>{selectedRequest.special_instructions}</p>
                  </div>
                )}
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleUpdate} className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-gray-900 text-sm">Update Status &amp; Admin Notes</h3>
                
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Request Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:border-brand"
                  >
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="waiting_on_customer">Waiting on Customer</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Admin Notes (internal only)</label>
                  <textarea
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    placeholder="Enter notes about e-transfer receipt, pickup slot, etc."
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:border-brand resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full py-2.5 bg-brand text-white font-semibold rounded-lg text-sm hover:bg-brand/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {updating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Save Request
                    </>
                  )}
                </button>
              </form>
            </div>
            
            <div className="pt-8 text-center text-[10px] text-gray-400 border-t mt-8">
              Received on {new Date(selectedRequest.created_at).toLocaleString()} • Updated {new Date(selectedRequest.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
