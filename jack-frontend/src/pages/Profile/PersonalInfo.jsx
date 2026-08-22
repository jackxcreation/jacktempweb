import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiEdit2, FiCheck, FiMessageSquare } from 'react-icons/fi';
import { useUser } from '../../context/UserContext';

const PersonalInfo = ({ showToast }) => {
  const { user, updateUserProfile } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || ''); // Backend updated to 'mobile', verify your context maps it correctly
    }
  }, [user]);

  const handleSaveProfile = async () => {
    const success = await updateUserProfile({ name: editName, phone: editPhone });
    if (success) {
      setIsEditing(false);
      showToast("Profile Updated Successfully!");
    } else {
      showToast("Failed to update profile", true);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Personal Details</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage your basic information and contact details.</p>
        </div>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold px-5 py-2.5 rounded-xl flex items-center transition-colors border border-slate-200"><FiEdit2 className="mr-2"/> Edit</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg">Cancel</button>
            <button onClick={handleSaveProfile} className="bg-[#FF4500] hover:bg-[#E8004C] text-white px-6 py-2.5 rounded-xl font-bold flex items-center shadow-md transition-colors"><FiCheck className="mr-2"/> Save</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center"><FiUser className="mr-1.5"/> Full Name</label>
          {isEditing ? (
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-3 focus:border-indigo-500 outline-none font-bold text-slate-800 shadow-sm" />
          ) : (
            <p className="text-lg font-black text-slate-900">{user.name}</p>
          )}
        </div>
        
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center"><FiMessageSquare className="mr-1.5"/> Email Address</label>
          <p className="text-lg font-black text-slate-600">{user.email}</p>
          <p className="text-[10px] text-green-600 font-bold mt-1 uppercase tracking-wider">Verified Account</p>
        </div>
        
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 md:col-span-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center"><FiMessageSquare className="mr-1.5"/> Mobile Number</label>
          {isEditing ? (
            <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/[^0-9]/g, ''))} maxLength={10} placeholder="10-digit mobile number" className="w-full md:w-1/2 bg-white border border-slate-300 rounded-xl p-3 focus:border-indigo-500 outline-none font-bold text-slate-800 shadow-sm" />
          ) : (
            <p className="text-lg font-black text-slate-900">{user.mobile || user.phone ? `+91 ${user.mobile || user.phone}` : <span className="text-slate-400 font-medium text-sm italic">Not provided yet</span>}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PersonalInfo;