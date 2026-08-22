import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiPlus, FiEdit2, FiTrash2, FiUser, FiMessageSquare } from 'react-icons/fi';
import { useUser } from '../../context/UserContext';

const AddressBook = ({ showToast }) => {
  const { user, updateUserProfile } = useUser();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null); 
  const [addressForm, setAddressForm] = useState({
    id: '', flat: '', street: '', landmark: '', pincode: '', city: '', state: '', primaryPhone: '', secondaryPhone: '', email: user?.email || ''
  });
  const [isFetchingPincode, setIsFetchingPincode] = useState(false);

  const handlePincodeChange = async (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setAddressForm({ ...addressForm, pincode: val });

    if (val.length === 6) {
      setIsFetchingPincode(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await response.json();
        if (data[0].Status === 'Success') {
          const postOffice = data[0].PostOffice[0];
          setAddressForm(prev => ({ ...prev, city: postOffice.District, state: postOffice.State }));
        }
      } catch (error) { console.error("Pincode fetch error:", error); }
      setIsFetchingPincode(false);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    let updatedAddresses;
    if (editingAddressId) {
      // 🔥 FIX: Check both id and _id safely
      updatedAddresses = (user.addresses || []).map(addr => 
        (addr.id || addr._id) === editingAddressId ? { ...addressForm, id: editingAddressId } : addr
      );
    } else {
      const newAddress = { ...addressForm, id: Date.now().toString() };
      updatedAddresses = [...(user.addresses || []), newAddress];
    }
    
    const success = await updateUserProfile({ addresses: updatedAddresses });
    if (success) {
      setShowAddressForm(false);
      setEditingAddressId(null);
      setAddressForm({ id: '', flat: '', street: '', landmark: '', pincode: '', city: '', state: '', primaryPhone: '', secondaryPhone: '', email: user.email || '' });
      showToast(editingAddressId ? "Address Updated!" : "New Address Saved!");
    } else {
      showToast("Failed to save address.", true);
    }
  };

  const handleEditClick = (addr) => {
    setAddressForm(addr);
    // 🔥 FIX: Set safely
    setEditingAddressId(addr.id || addr._id);
    setShowAddressForm(true);
    window.scrollTo({ top: 200, behavior: 'smooth' }); 
  };

  const handleCancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressForm({ id: '', flat: '', street: '', landmark: '', pincode: '', city: '', state: '', primaryPhone: '', secondaryPhone: '', email: user.email || '' });
  };

  const handleDeleteAddress = async (idToDelete) => {
    if(window.confirm("Are you sure you want to delete this address?")) {
      // 🔥 FIX: Delete safely checking both ID types
      const updatedAddresses = (user.addresses || []).filter(addr => (addr.id || addr._id) !== idToDelete);
      await updateUserProfile({ addresses: updatedAddresses });
      showToast("Address Deleted.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Address Book</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage your delivery locations for faster checkout.</p>
        </div>
        {!showAddressForm && (
          <button onClick={() => setShowAddressForm(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-md hover:bg-[#FF4500] transition-colors">
            <FiPlus className="mr-2"/> New
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddressForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleSaveAddress} className="bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200 mb-8 shadow-inner overflow-hidden">
            <h3 className="text-sm font-black text-indigo-600 mb-6 uppercase tracking-wider flex items-center">
              {editingAddressId ? <><FiEdit2 className="mr-2"/> Edit Address</> : <><FiMapPin className="mr-2"/> Add New Delivery Address</>}
            </h3>
            
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Pincode *</label>
                  <div className="relative">
                    <input type="text" maxLength={6} required value={addressForm.pincode} onChange={handlePincodeChange} placeholder="6-digit pin" className="w-full border border-slate-300 rounded-xl p-3.5 text-sm font-bold tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                    {isFetchingPincode && <span className="absolute right-3 top-3.5 text-[10px] font-bold text-indigo-500 animate-pulse uppercase">Fetching...</span>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">City/District</label>
                  <input type="text" required value={addressForm.city} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-3.5 text-sm text-slate-600 font-bold outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">State</label>
                  <input type="text" required value={addressForm.state} readOnly className="w-full border border-slate-200 bg-slate-100 rounded-xl p-3.5 text-sm text-slate-600 font-bold outline-none cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Flat, House no., Building *</label>
                  <input type="text" required value={addressForm.flat} onChange={e => setAddressForm({...addressForm, flat: e.target.value})} className="w-full border border-slate-300 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-indigo-500 transition-all bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Area, Street, Sector *</label>
                  <input type="text" required value={addressForm.street} onChange={e => setAddressForm({...addressForm, street: e.target.value})} className="w-full border border-slate-300 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-indigo-500 transition-all bg-white" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Landmark (Optional)</label>
                <input type="text" value={addressForm.landmark} onChange={e => setAddressForm({...addressForm, landmark: e.target.value})} placeholder="E.g. near Apollo Hospital" className="w-full border border-slate-300 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-indigo-500 transition-all bg-white" />
              </div>

              <div className="pt-6 border-t border-slate-200 mt-2">
                <h4 className="text-xs font-black text-slate-800 mb-4 uppercase tracking-widest">Contact Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Primary Mobile *</label>
                    <input type="tel" required maxLength="10" value={addressForm.primaryPhone} onChange={e => setAddressForm({...addressForm, primaryPhone: e.target.value.replace(/[^0-9]/g, '')})} placeholder="10-digit number" className="w-full border border-slate-300 rounded-xl p-3.5 text-sm font-bold tracking-widest outline-none focus:border-indigo-500 transition-all bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Secondary Mobile</label>
                    <input type="tel" maxLength="10" value={addressForm.secondaryPhone} onChange={e => setAddressForm({...addressForm, secondaryPhone: e.target.value.replace(/[^0-9]/g, '')})} placeholder="Optional alternate no." className="w-full border border-slate-300 rounded-xl p-3.5 text-sm font-bold tracking-widest outline-none focus:border-indigo-500 transition-all bg-white" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-4 px-8 rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                {editingAddressId ? 'UPDATE ADDRESS' : 'SAVE NEW ADDRESS'}
              </button>
              <button type="button" onClick={handleCancelAddressForm} className="sm:w-max w-full bg-white border border-slate-300 text-slate-700 font-bold py-4 px-8 rounded-xl hover:bg-slate-100 transition-all">
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(!user.addresses || user.addresses.length === 0) ? (
          !showAddressForm && (
            <div className="col-span-full p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4"><FiMapPin size={24}/></div>
              <p className="text-slate-500 font-bold text-lg mb-1">No addresses saved</p>
              <p className="text-slate-400 text-sm">Add an address to ensure faster checkout experience.</p>
            </div>
          )
        ) : (
          user.addresses.map((addr, idx) => {
            // 🔥 MAIN KEY WARNING FIX 🔥 Safe ID extraction for keys and mapping
            const safeAddressId = addr.id || addr._id || `fallback-idx-${idx}`;
            
            return (
              <div key={safeAddressId} className={`border rounded-3xl p-6 relative transition-all group hover:shadow-md ${editingAddressId === safeAddressId ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
                {idx === 0 && <span className="absolute top-0 right-6 -translate-y-1/2 bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Default Address</span>}
                <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-widest mb-3 inline-block">HOME</span>
                <p className="font-bold text-slate-900 text-base leading-snug">{addr.flat}, {addr.street}</p>
                {addr.landmark && <p className="text-slate-500 text-sm mt-1">Near {addr.landmark}</p>}
                <p className="text-slate-700 text-sm font-medium mt-1 mb-4">{addr.city}, {addr.state} - <span className="font-black text-slate-900">{addr.pincode}</span></p>
                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 border border-slate-100">
                  <p className="text-slate-600"><FiUser className="inline mr-1 text-slate-400"/> <span className="font-bold text-slate-800">{user.name}</span></p>
                  <p className="text-slate-600"><FiMessageSquare className="inline mr-1 text-slate-400"/> +91 {addr.primaryPhone}</p>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => handleEditClick(addr)} className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-2 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors text-xs flex justify-center items-center"><FiEdit2 className="mr-1.5"/> Edit</button>
                  <button onClick={() => handleDeleteAddress(safeAddressId)} className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-2 rounded-lg hover:border-red-500 hover:text-red-500 transition-colors text-xs flex justify-center items-center"><FiTrash2 className="mr-1.5"/> Remove</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default AddressBook;