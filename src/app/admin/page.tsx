// app/admin/page.tsx
'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';

export default function AdminPanel() {
  // Module Switches
  const [config, setConfig] = useState({
    registrationEnabled: true,
    foodModuleEnabled: false, // Default off for basic events
  });

  const pendingSync = useLiveQuery(() => db.guests.where('syncStatus').equals('pending').count());

  const handleSync = async () => {
    const unsynced = await db.guests.where('syncStatus').equals('pending').toArray();
    // Logic to POST unsynced guests to your Oracle Cloud API
    console.log("Syncing to Lyss Cloud...", unsynced);
    // After success: db.guests.toCollection().modify({ syncStatus: 'synced' });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-orange-600">Mithila Aayojan Dashboard</h1>
        <div className="bg-blue-100 p-2 rounded text-sm">Offline Records: {pendingSync || 0}</div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module Toggles */}
        <div className="border p-4 rounded shadow">
          <h2 className="font-semibold mb-4">Module Controls</h2>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={config.registrationEnabled} 
              onChange={(e) => setConfig({...config, registrationEnabled: e.target.checked})} />
            Gate Entry Module
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={config.foodModuleEnabled} 
              onChange={(e) => setConfig({...config, foodModuleEnabled: e.target.checked})} />
            Food Coupon Module
          </label>
        </div>

        {/* Sync Action */}
        <div className="border p-4 rounded shadow flex flex-col justify-center items-center">
          <button 
            onClick={handleSync}
            className="bg-orange-500 text-white px-6 py-2 rounded-full font-bold hover:bg-orange-600"
          >
            Sync Data to Lyss Cloud
          </button>
        </div>
      </section>
    </div>
  );
}