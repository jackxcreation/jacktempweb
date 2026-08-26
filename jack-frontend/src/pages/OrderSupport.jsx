import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiBox, FiMessageSquare } from 'react-icons/fi';
import Chat from '../components/Chat'; // Step 2 mein banayenge

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const OrderSupport = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    // API se order details fetch karo
    fetch(`http://localhost:5000/api/orders/${orderId}`)
      .then(res => res.json())
      .then(data => setOrder(data));
  }, [orderId]);

  if (!order) return <div className="p-20 text-center">Loading Order Details...</div>;

  const itemPricePaise = order.items && order.items[0] ? (order.items[0].pricePaise || 0) : 0;

  return (
    <div className="min-h-screen bg-slate-50 pt-24 px-4 pb-12">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: Order Details (Flipkart Style) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <Link to="/help-center" className="flex items-center text-slate-500 font-bold mb-6 hover:text-[#FF4500]">
            <FiArrowLeft className="mr-2"/> Back to Help Center
          </Link>
          <h1 className="text-2xl font-black mb-4">Support for #{order.id ? order.id.slice(-8) : orderId.slice(-8)}</h1>
          <div className="bg-slate-50 p-4 rounded-2xl flex gap-4 items-center">
            <img src={order.items[0]?.image || order.items[0]?.images?.[0]} className="w-20 h-20 rounded-lg object-contain bg-white p-1 border border-slate-100" alt="Product" />
            <div>
              <p className="font-bold text-slate-800">{order.items[0]?.title}</p>
              <p className="text-sm font-black text-[#FF4500] mt-1">{formatCurrency(itemPricePaise)}</p>
              <p className="text-xs text-slate-500 mt-1">Status: <span className="font-bold text-slate-700">{order.status}</span></p>
            </div>
          </div>
        </div>

        {/* Right: Dedicated Premium Chat Interface */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
          <h3 className="font-black text-lg mb-4 flex items-center"><FiMessageSquare className="mr-2 text-[#FF4500]"/> Chat Support</h3>
          <div className="flex-1 flex flex-col">
            <Chat orderId={orderId} />
          </div>
        </div>

      </div>
    </div>
  );
};
export default OrderSupport;