// jack-frontend/src/pages/OrderSupport.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiAlertCircle, FiMessageSquare, FiPackage } from 'react-icons/fi';
import Chat from "./Chat";
import axiosInstance from '../api/axiosInstance'; 

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper for Status Badge Colors
const getStatusBadgeColor = (status = '') => {
  const s = status.toLowerCase();
  if (['delivered', 'completed', 'resolved'].includes(s)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (['shipped', 'dispatched'].includes(s)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (['cancelled', 'failed', 'rto'].includes(s)) return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-amber-100 text-amber-800 border-amber-200'; // Pending / Processing
};

const OrderSupport = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    
    axiosInstance.get(`/orders/${orderId}`)
      .then(res => {
        setOrder(res.data?.order || res.data);
      })
      .catch(err => {
        console.error("Error fetching order:", err);
        setError(err.response?.data?.message || "Failed to load order details.");
      });
  }, [orderId]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 pt-32 px-4 text-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <FiAlertCircle className="mx-auto text-red-500 mb-4" size={40} />
          <h2 className="text-xl font-black text-slate-900 mb-2">Could Not Load Order</h2>
          <p className="text-slate-500 text-sm mb-6 font-medium">{error}</p>
          <Link to="/help-center" className="bg-slate-900 hover:bg-[#FF4500] text-white px-6 py-3 rounded-xl font-bold transition-all inline-block cursor-pointer">
            Back to Help Center
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#FF4500] rounded-full animate-spin"></div>
        <span className="text-slate-400 font-medium text-sm tracking-wide">Connecting to Support Systems...</span>
      </div>
    );
  }

  const firstItem = order.items && order.items[0] ? order.items[0] : {};
  const additionalItemsCount = (order.items?.length || 1) - 1;
  
  // 🔥 UPGRADE: Prioritize overall order total, fallback to item price
  const orderTotalPaise = order.totalPaise || order.totalAmountPaise || (order.totalAmount ? order.totalAmount * 100 : (firstItem.pricePaise || 0));
  const displayId = order.id || order._id || order.orderId || orderId;

  return (
    <div className="min-h-screen bg-slate-50 pt-28 px-4 pb-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left: Order Details (Flipkart Style) - Takes up 5 columns */}
        <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <Link to="/help-center" className="flex items-center text-slate-500 font-bold mb-6 hover:text-[#FF4500] transition-colors w-max">
            <FiArrowLeft className="mr-2"/> Back to Help
          </Link>
          
          <h1 className="text-xl md:text-2xl font-black mb-1 text-slate-900">
            Order Support
          </h1>
          <p className="text-sm font-medium text-slate-500 mb-6 font-mono">#{displayId ? String(displayId).slice(-10).toUpperCase() : '-----'}</p>
          
          <div className="bg-slate-50 p-4 rounded-2xl flex gap-4 items-center border border-slate-100 mb-6">
            <div className="relative flex-shrink-0">
              {firstItem.image || (firstItem.images && firstItem.images[0]) ? (
                <img 
                  src={firstItem.image || firstItem.images[0]} 
                  className="w-20 h-20 rounded-xl object-cover bg-white border border-slate-200" 
                  alt={firstItem.title || 'Product'} 
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                  <FiPackage size={24} />
                </div>
              )}
              {/* Extra Items Indicator */}
              {additionalItemsCount > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm">
                  +{additionalItemsCount}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 text-sm truncate">{firstItem.title || firstItem.name || 'Product Item'}</p>
              <p className="text-lg font-black text-[#FF4500] mt-0.5">{formatCurrency(orderTotalPaise)}</p>
              
              <div className="mt-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md border capitalize ${getStatusBadgeColor(order.status || 'Processing')}`}>
                  {order.status || 'Processing'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100 text-xs text-slate-400 space-y-1.5">
            <p className="flex justify-between">
              <span className="font-medium">Order Date:</span> 
              <span className="text-slate-600 font-bold">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}</span>
            </p>
            <p className="flex justify-between">
              <span className="font-medium">Payment Mode:</span> 
              <span className="text-slate-600 font-bold capitalize">{order.paymentMethod || order.paymentMode || 'Prepaid'}</span>
            </p>
            <p className="mt-4 text-slate-500">Need urgent assistance? Our support bot resolves most issues instantly.</p>
          </div>
        </div>

        {/* Right: Dedicated Premium Chat Interface - Takes up 7 columns */}
        <div className="lg:col-span-7 bg-white p-0 md:p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[500px] h-[75vh] flex flex-col overflow-hidden">
          <div className="p-4 md:p-0 md:mb-4 flex items-center border-b border-slate-100 md:border-0">
            <FiMessageSquare className="mr-2 text-[#FF4500] text-xl"/>
            <h3 className="font-black text-lg text-slate-900">Jack Essentials Support</h3>
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden relative rounded-xl border border-slate-100 bg-slate-50 md:bg-transparent md:border-0">
            {/* 🔥 CRITICAL UPGRADE: Passing the FULL order object as contextData so AI knows exactly what to talk about */}
            <Chat orderId={orderId} contextData={order} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderSupport;