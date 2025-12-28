import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  writeBatch
} from 'firebase/firestore';

// --- DATE UTILITIES ---
const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getMonday = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0); 
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(date.setDate(diff));
};

const generateWeekDays = (startDateStr) => {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d); 
    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        days.push({ 
            label: date.toLocaleDateString('en-US', { weekday: 'short' }), 
            dateStr: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            fullDate: formatDateKey(date) 
        });
    }
    return days;
};

// --- INITIAL SEED DATA ---
const INITIAL_MASTER_PRODUCTS = [
    { name: 'WS BACON, Egg & Cheese', defaultOrder: 1 }, 
    { name: 'WS SAUSAGE, Egg & Cheese', defaultOrder: 2 },
    { name: 'WS EGG & Cheese', defaultOrder: 3 }, 
    { name: 'WS Chix Salad Sandwich', defaultOrder: 4 },
    { name: 'WS Chicken Bacon Ranch Wrap', defaultOrder: 5 }, 
    { name: 'WS Italian SandTurkey & Ham', defaultOrder: 6 },
    { name: 'WS SconesCookies', defaultOrder: 7 }, 
    { name: 'WSMuffins', defaultOrder: 8 },
    { name: 'WSChocolate Croissants', defaultOrder: 9 }, 
    { name: 'WSWS Almond Croissants', defaultOrder: 10 },
    { name: 'WS Croissant Plain', defaultOrder: 11 }, 
    { name: 'Cinnamon Rolls WS', defaultOrder: 12 },
    { name: 'WS Yogurt Parfaits', defaultOrder: 13 }, 
    { name: 'WS Overnight Oats', defaultOrder: 14 },
    { name: 'WS Rice Crispy Bars', defaultOrder: 15 }, 
    { name: 'WS Pumpkin Bread/Banana/etc LOAVES', defaultOrder: 16 },
    { name: 'Chia Pudding', defaultOrder: 17 }
];

const App = () => {
    // --- STATE ---
    const [users, setUsers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [masterProducts, setMasterProducts] = useState([]);
    const [entries, setEntries] = useState([]);
    
    // UI State
    const [currentUser, setCurrentUser] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [weekStart, setWeekStart] = useState(formatDateKey(getMonday(new Date())));
    const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date())); 
    const [showSettings, setShowSettings] = useState(false);

    // Drag and Drop State
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // --- FIREBASE SYNC ---
    useEffect(() => {
        const qProducts = query(collection(db, "products"), orderBy("defaultOrder"));
        const unsubProducts = onSnapshot(qProducts, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setMasterProducts(list);
            if(list.length === 0) seedProducts();
        });

        const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(list);
            if (list.length === 0) seedUsers();
        });

        const unsubAccounts = onSnapshot(collection(db, "accounts"), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAccounts(list);
            if(list.length > 0 && !selectedAccountId) setSelectedAccountId(list[0].id);
            if(list.length === 0 && masterProducts.length > 0) seedAccounts(masterProducts);
        });

        const unsubEntries = onSnapshot(collection(db, "entries"), (snap) => {
            setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubUsers(); unsubAccounts(); unsubProducts(); unsubEntries(); };
    }, [masterProducts.length]); 

    // --- SEEDING ---
    const seedUsers = async () => {
        await addDoc(collection(db, "users"), { name: 'Admin', pin: '8888', isAdmin: true });
        await addDoc(collection(db, "users"), { name: 'Staff', pin: '1234', isAdmin: false });
    };
    const seedAccounts = async (products) => {
        const allIds = products.map(p => p.id);
        await addDoc(collection(db, "accounts"), { name: 'Narrative Coffee', productIds: allIds }); 
        await addDoc(collection(db, "accounts"), { name: 'Good Ground Coffee', productIds: allIds });
    };
    const seedProducts = async () => {
        for(const p of INITIAL_MASTER_PRODUCTS) {
            await addDoc(collection(db, "products"), p);
        }
    };

    // --- HELPERS ---
    const weekDays = useMemo(() => generateWeekDays(weekStart), [weekStart]);
    const selectedAccount = accounts.find(a => a.id === selectedAccountId) || { name: 'Loading...', productIds: [] };
    const accountProducts = masterProducts.filter(p => (selectedAccount.productIds || []).includes(p.id));

    const weekLabel = useMemo(() => {
        if(weekDays.length < 7) return "";
        const start = weekDays[0];
        const end = weekDays[6];
        const [sy, sm, sd] = start.fullDate.split('-').map(Number);
        const [ey, em, ed] = end.fullDate.split('-').map(Number);
        const d1 = new Date(sy, sm-1, sd);
        const d2 = new Date(ey, em-1, ed);
        const opts = { month: 'numeric', day: 'numeric', year: '2-digit' };
        return `${d1.toLocaleDateString('en-US', opts)} - ${d2.toLocaleDateString('en-US', opts)}`;
    }, [weekDays]);

    // --- ACTIONS ---
    const handleLogin = () => {
        const user = users.find(u => u.pin === pinInput);
        if (user) { 
            setCurrentUser(user); 
            setPinInput(''); 
        } else { 
            alert('Invalid PIN'); 
            setPinInput('');
        }
    };

    const updateEntry = async (date, prodId, val) => {
        const existing = entries.find(e => e.accountId === selectedAccountId && e.date === date && e.productId === prodId);
        const valueInt = val === '' ? 0 : parseInt(val);

        if (existing) {
            await updateDoc(doc(db, "entries", existing.id), { value: valueInt });
        } else {
            if(valueInt > 0) { 
                await addDoc(collection(db, "entries"), {
                    accountId: selectedAccountId,
                    date: date,
                    productId: prodId,
                    value: valueInt
                });
            }
        }
    };

    const getEntryVal = (date, prodId) => {
        const found = entries.find(e => e.accountId === selectedAccountId && e.date === date && e.productId === prodId);
        return (found && found.value !== 0) ? found.value : '';
    };

    const getRowTotal = (prodId) => weekDays.reduce((sum, d) => {
        const val = entries.find(e => e.accountId === selectedAccountId && e.date === d.fullDate && e.productId === prodId);
        return sum + (val ? val.value : 0);
    }, 0);

    const handleNumericKeyDown = (e, index) => {
        if (["e", "E", "+", "-", "."].includes(e.key)) {
            e.preventDefault();
        }
        if (e.key === 'Enter' && index !== undefined) {
            e.preventDefault();
            const nextInput = document.getElementById(`input-${index + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); } 
            else { e.target.blur(); }
        }
    };

    const changeWeek = (offset) => {
        const [y, m, d] = weekStart.split('-').map(Number);
        const current = new Date(y, m - 1, d);
        current.setDate(current.getDate() + offset);
        setWeekStart(formatDateKey(current));
    };

    const downloadCSV = () => {
        let csv = `Account:,${selectedAccount.name}\nWeek Starting:,${weekStart}\n\n`;
        csv += "Product," + weekDays.map(d => `${d.label} (${d.dateStr})`).join(",") + ",Total\n";
        accountProducts.forEach(p => {
            const row = [p.name.replace(/,/g, '')];
            weekDays.forEach(d => row.push(getEntryVal(d.fullDate, p.id) || 0));
            row.push(getRowTotal(p.id));
            csv += row.join(",") + "\n";
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedAccount.name}_Week_${weekStart}.csv`;
        a.click();
    };

    const clearWeek = async () => {
        if (!confirm(`WARNING: Delete all data for ${selectedAccount.name} this week?`)) return;
        const toDelete = entries.filter(e => e.accountId === selectedAccountId && weekDays.some(day => day.fullDate === e.date));
        for(const entry of toDelete) { await deleteDoc(doc(db, "entries", entry.id)); }
    };

    // --- ADMIN ACTIONS ---
    const toggleProductForAccount = async (pid) => {
        const currentIds = selectedAccount.productIds || [];
        const hasIt = currentIds.includes(pid);
        let newIds = hasIt ? currentIds.filter(id => id !== pid) : [...currentIds, pid];
        await updateDoc(doc(db, "accounts", selectedAccountId), { productIds: newIds });
    };

    const updateUser = async (id, field, value) => {
        await updateDoc(doc(db, "users", id), { [field]: value });
    };
    
    const addUser = async () => {
        const n = prompt("Name:"); const p = prompt("PIN:");
        if(n && p) await addDoc(collection(db, "users"), { name: n, pin: p, isAdmin: false });
    };

    const deleteUser = async (id) => {
        if(confirm("Delete User?")) await deleteDoc(doc(db, "users", id));
    };

    const renameProduct = async (id, newName) => {
        await updateDoc(doc(db, "products", id), { name: newName });
    };

    const handleSort = async () => {
        const _products = [...masterProducts];
        const draggedItemContent = _products.splice(dragItem.current, 1)[0];
        _products.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setMasterProducts(_products);
        const batch = writeBatch(db);
        _products.forEach((p, index) => {
            const ref = doc(db, "products", p.id);
            batch.update(ref, { defaultOrder: index + 1 });
        });
        await batch.commit();
    };

    // --- RENDER ---
    if (!currentUser) return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
             <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
                <h1 className="text-3xl font-black text-slate-800 mb-8">BL Weekly Counts</h1>
                <input type="password" inputMode="numeric" value={pinInput} onChange={e=>setPinInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus
                    className="border-b-4 border-slate-100 p-4 mb-8 w-full text-center text-5xl tracking-widest outline-none focus:border-blue-500" placeholder="••••"/>
                <button onClick={handleLogin} className="bg-blue-600 text-white w-full py-4 rounded-2xl font-bold text-xl shadow-lg">Login</button>
             </div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto min-h-screen pb-20">
            <header className="p-4 flex justify-between items-center sticky top-0 bg-slate-100/90 backdrop-blur-md z-40 border-b border-slate-200">
                <div className="relative">
                    <select value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)} className="appearance-none bg-transparent font-black text-lg sm:text-2xl pr-8 outline-none cursor-pointer text-slate-800 max-w-[180px] sm:max-w-none truncate">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Logged in as</div>
                        <div className="font-bold text-sm">{currentUser.name}</div>
                    </div>
                    {currentUser.isAdmin && <button onClick={()=>setShowSettings(true)} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-lg hover:bg-slate-100">⚙️</button>}
                    <button onClick={()=>setCurrentUser(null)} className="text-xs font-bold text-slate-500 hover:text-red-500 px-3 py-2 bg-white rounded-xl border border-slate-200">Logout</button>
                </div>
            </header>

            {showSettings && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h2 className="text-xl font-bold text-slate-800">Admin Panel</h2>
                            <button onClick={()=>setShowSettings(false)} className="text-slate-400 hover:text-red-500 text-2xl">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-8">
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Manage Users</h3>
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border">
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Name</label>
                                            <input value={u.name} onChange={e=>updateUser(u.id, 'name', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                                        </div>
                                        <div className="w-20">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">PIN</label>
                                            <input value={u.pin} onChange={e=>updateUser(u.id, 'pin', e.target.value)} className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                                        </div>
                                        <div className="pt-5"><button onClick={()=>deleteUser(u.id)} className="text-red-500 p-2 hover:bg-red-50 rounded">✕</button></div>
                                    </div>
                                ))}
                                <button onClick={addUser} className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-400 rounded-lg font-bold text-sm hover:border-blue-500 hover:text-blue-500 transition-colors">+ Add New User</button>
                            </section>
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Menu (Drag to Sort)</h3>
                                {masterProducts.map((p, idx) => (
                                    <div 
                                        key={p.id} 
                                        draggable
                                        onDragStart={(e) => { dragItem.current = idx; e.currentTarget.classList.add('opacity-50'); }}
                                        onDragEnter={(e) => { dragOverItem.current = idx; }}
                                        onDragEnd={(e) => { handleSort(); e.currentTarget.classList.remove('opacity-50'); }}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 cursor-move mb-2 transition-all active:scale-95"
                                    >
                                        <span className="text-slate-300 text-lg">☰</span>
                                        <input type="checkbox" 
                                            checked={(selectedAccount.productIds || []).includes(p.id)} 
                                            onChange={()=>toggleProductForAccount(p.id)} 
                                            className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                                        />
                                        <input 
                                            type="text" 
                                            value={p.name} 
                                            onChange={(e) => renameProduct(p.id, e.target.value)}
                                            className="text-sm font-medium flex-1 bg-transparent border-b border-transparent focus:border-slate-300 outline-none"
                                        />
                                    </div>
                                ))}
                                <button onClick={async () => { const n = prompt("Item Name:"); if(n) await addDoc(collection(db, "products"), { name: n, defaultOrder: masterProducts.length + 1 }); }} className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-400 rounded-lg font-bold text-sm mt-2">+ Create Item</button>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            <main className="px-4 space-y-6 mt-6">
                 <div className="sm:hidden flex justify-between items-center bg-blue-50 p-4 rounded-2xl">
                    <div><span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">Logged in as</span><span className="text-sm font-bold text-blue-800">Hi, {currentUser.name}</span></div>
                </div>

                <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Entry</h3>
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg">
                            <button onClick={()=>changeWeek(-7)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-500 hover:text-blue-600">‹</button>
                            <span className="text-xs font-bold text-slate-600 uppercase px-3">{weekLabel}</span>
                            <button onClick={()=>changeWeek(7)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-500 hover:text-blue-600">›</button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                        {weekDays.map(d => (
                            <button key={d.fullDate} onClick={()=>setSelectedDate(d.fullDate)} 
                                className={`flex-shrink-0 px-3 py-3 rounded-xl text-center transition-all ${selectedDate === d.fullDate ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-500'}`}>
                                <div className="text-[10px] opacity-80 uppercase font-bold">{d.label}</div>
                                <div className="font-bold text-sm">{d.dateStr}</div>
                            </button>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {accountProducts.map((p, index) => (
                            <div key={p.id} className="flex items-center justify-between gap-4">
                                <label className="font-medium text-slate-700 text-sm leading-tight flex-1">{p.name}</label>
                                <input 
                                    id={`input-${index}`}
                                    type="number" inputMode="numeric"
                                    value={getEntryVal(selectedDate, p.id)}
                                    onChange={(e)=>updateEntry(selectedDate, p.id, e.target.value)}
                                    onKeyDown={(e)=>handleNumericKeyDown(e, index)}
                                    onFocus={(e)=>e.target.select()}
                                    placeholder="0"
                                    className="w-20 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-300"
                                />
                            </div>
                        ))}
                        {accountProducts.length === 0 && (
                            <div className="text-center py-8 text-slate-400 italic">
                                No items assigned to this menu.<br/>Go to Admin (⚙️) to add items.
                            </div>
                        )}
                    </div>
                     <div className="mt-6 p-4 bg-green-50 rounded-xl flex items-center justify-center gap-2 text-green-700 font-bold text-sm">
                        <span>✓ Saving to Cloud...</span>
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Overview</h3>
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 text-left sticky-col font-bold text-slate-500 text-xs uppercase tracking-wider bg-slate-50 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">Product</th>
                                        {weekDays.map(d => <th key={d.fullDate} className="p-2 text-center text-slate-500 text-xs font-bold">{d.label}</th>)}
                                        <th className="p-4 text-center bg-blue-50 text-blue-600 font-bold text-xs uppercase">Tot</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accountProducts.map((p, idx) => (
                                        <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                            <td className={`p-3 sticky-col font-medium text-slate-700 text-xs whitespace-nowrap shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>{p.name}</td>
                                            {weekDays.map(d => (
                                                <td key={d.fullDate} className="p-1 text-center font-medium text-slate-600">
                                                    <input 
                                                        type="number" 
                                                        inputMode="numeric"
                                                        value={getEntryVal(d.fullDate, p.id)} 
                                                        onChange={(e)=>updateEntry(d.fullDate, p.id, e.target.value)}
                                                        onKeyDown={(e) => handleNumericKeyDown(e)} 
                                                        onFocus={(e)=>e.target.select()}
                                                        placeholder="-"
                                                        className="w-full h-8 bg-transparent text-center focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-blue-500 rounded text-slate-600 font-medium outline-none p-0"
                                                    />
                                                </td>
                                            ))}
                                            <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/30">{getRowTotal(p.id)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 font-bold text-slate-600">
                                        <td className="p-3 sticky-col bg-slate-100 text-xs uppercase shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">Total</td>
                                        {weekDays.map(d => <td key={d.fullDate} className="p-3 text-center text-xs">{accountProducts.reduce((sum, p) => sum + (parseInt(getEntryVal(d.fullDate, p.id)) || 0), 0)}</td>)}
                                        <td className="p-3 text-center bg-blue-600 text-white">{accountProducts.reduce((sum, p) => sum + getRowTotal(p.id), 0)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 text-xs font-bold hover:text-green-600 hover:border-green-200"><span>Download CSV</span></button>
                            {currentUser.isAdmin && <button onClick={clearWeek} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 text-xs font-bold hover:text-red-600 hover:border-red-200"><span>Clear Week</span></button>}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default App;