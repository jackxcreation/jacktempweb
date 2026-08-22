import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPackage, FiCheckCircle, FiShield } from 'react-icons/fi';
import { useUser } from '../../context/UserContext';

const OrderHistory = () => {
  const navigate = useNavigate();
  const { orders } = useUser();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-100">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Order History</h2>
      <p className="text-sm text-slate-500 font-medium mb-8 border-b border-slate-100 pb-4">Track, return, or buy items again.</p>
      
      <div className="space-y-6">
        {!orders || orders.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-5"><FiPackage size={32} className="text-slate-300" /></div>
            <h3 className="font-black text-slate-800 text-xl mb-2">No orders found</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">You haven't placed any orders yet. Discover our premium collection and treat yourself.</p>
            <button onClick={() => navigate('/shop')} className="bg-slate-900 text-white font-black px-8 py-3.5 rounded-xl shadow-md hover:bg-[#FF4500] transition-colors active:scale-95">START SHOPPING</button>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="border border-slate-100 rounded-3xl overflow-hidden hover:shadow-md transition-all group bg-white">
              <div className="bg-slate-50 px-5 py-4 flex flex-wrap justify-between items-center border-b border-slate-100 gap-4">
                <div className="flex gap-6 sm:gap-10 w-full sm:w-auto">
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Order Placed</p>
                    <p className="text-sm font-bold text-slate-800">{order.date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total</p>
                    <p className="text-sm font-black text-slate-900">₹{order.totalAmount}</p>
                  </div>
                </div>
                <div className="w-full sm:w-auto sm:text-right">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Order ID</p>
                  <p className="text-sm font-mono font-bold text-slate-700">#{order.id.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>
              
              <div className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4 border-b border-slate-50 pb-6">
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5
                      ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                        order.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 
                        'bg-indigo-100 text-indigo-700'}`}>
                      {order.status === 'Delivered' ? <FiCheckCircle size={12}/> : order.status === 'Cancelled' ? <FiShield size={12}/> : <FiPackage size={12}/>}
                      {order.status}
                    </span>
                    {order.shiprocketOrderId && <span className="text-xs font-mono text-slate-400">AWB: {order.shiprocketOrderId}</span>}
                  </div>
                  <button onClick={() => navigate(`/order/${order.id}`)} className="bg-slate-900 hover:bg-[#FF4500] text-white text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 w-max">
                    Track Package &rarr;
                  </button>
                </div>
                
                <div className="space-y-4">
                  {order.items && order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-xl p-1.5 border border-slate-100 flex-shrink-0 relative overflow-hidden group-hover:border-slate-300 transition-colors">
                        <img src={item.image || (item.images && item.images[0])} alt={item.title} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{item.title}</h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">Qty: {item.quantity}</p>
                          <button className="text-xs font-bold text-indigo-600 hover:underline">Buy it again</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default OrderHistory;