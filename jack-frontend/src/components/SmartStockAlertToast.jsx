import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export const SmartStockAlertToast = () => {
  const [alertInfo, setAlertInfo] = useState(null);

  useEffect(() => {
    // 🔥 FIX: Pehle check karo ki token localStorage mein hai ya nahi
    const token = localStorage.getItem('token');
    
    // Agar token nahi hai (yani user login nahi hai), toh wapas laut jao (Socket connect mat karo)
    if (!token) return;

    // Agar token mil gaya, tabhi safely socket connect karo
    const socket = io(window.location.origin.includes('localhost') ? 'http://localhost:5000' : undefined, {
      auth: { token }
    });

    socket.on('stock_alert_notification', (data) => {
      setAlertInfo(data);
      setTimeout(() => {
        setAlertInfo(null);
      }, 6000); // Hide after 6 seconds
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (!alertInfo) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#10B981',
      color: '#fff',
      padding: '16px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <div>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>📦 Stock Alert!</h4>
        <p style={{ margin: 0, fontSize: '14px' }}>{alertInfo.message || 'Item is back in stock!'}</p>
      </div>
      <button 
        onClick={() => setAlertInfo(null)}
        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}
      >
        ✕
      </button>
    </div>
  );
};