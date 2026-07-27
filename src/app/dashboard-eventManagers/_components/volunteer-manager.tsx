'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserCheck, X, Check, Edit2, Users, PlusCircle, Shield } from 'lucide-react';
import { db } from '../../../lib/db';

type DeskScope = 'CHECK_IN' | 'FOOD_CLAIM' | 'ALL';

interface VolunteerManagerProps {
  isDark: boolean;
  events: any[];
  onClose: () => void;
}

export default function VolunteerManager({ isDark, events, onClose }: VolunteerManagerProps) {
  // 🟢 ACTIVE ROSTER IS NOW THE DEFAULT TAB ON OPENING
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('list');
  
  // Form State
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [volunteerName, setVolunteerName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDesk, setSelectedDesk] = useState<DeskScope>('CHECK_IN');
  const [assignAll, setAssignAll] = useState(true);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. LIVE QUERY: FETCH ALL VOLUNTEERS AND THEIR EVENT LINKS FROM DEXIE
  const volunteersList = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();
    const users = await db.users.where('role').equals('volunteer').toArray();
    const links = await db.managerEvents.toArray();

    return users.map((usr) => {
      const userLinks = links.filter(
        (l) => l.managerIdentifier?.toLowerCase() === usr.identifier?.toLowerCase()
      );
      const assignedDesk = userLinks[0]?.assignedDesk || 'CHECK_IN';
      const eventIds = userLinks.map((l) => Number(l.eventId));

      return {
        ...usr,
        assignedDesk,
        eventIds,
        assignedCount: userLinks.length,
      };
    });
  }, []) || [];

  const handleToggleEvent = (eventId: number) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const resetForm = () => {
    setEditingUserId(null);
    setVolunteerName('');
    setIdentifier('');
    setPassword('');
    setSelectedDesk('CHECK_IN');
    setAssignAll(true);
    setSelectedEventIds([]);
  };

  // Populate form for editing existing volunteer and switch to create/edit tab
  const handleEditVolunteer = (vol: any) => {
    setEditingUserId(vol.id);
    setVolunteerName(vol.name || '');
    setIdentifier(vol.identifier || '');
    setPassword(vol.passkey || vol.passwordHash || '');
    setSelectedDesk(vol.assignedDesk || 'CHECK_IN');
    setSelectedEventIds(vol.eventIds || []);
    setAssignAll(vol.eventIds?.length === events.length);
    setActiveTab('create');
  };

  const handleCreateOrUpdateVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanName = volunteerName.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword || !cleanName) return;

    // Resolve target event IDs strictly
    const targetEvents = assignAll
      ? events.map((e) => Number(e.id)).filter((id) => !isNaN(id) && id > 0)
      : selectedEventIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);

    if (targetEvents.length === 0) {
      alert('Please select at least one valid event to assign to this volunteer.');
      return;
    }

    setIsSaving(true);
    try {
      await db.transaction('rw', [db.users, db.managerEvents], async () => {
        // Step A: Upsert User Record
        const existingUser = await db.users
          .where('identifier')
          .equals(cleanIdentifier)
          .first()
          .catch(() => null);

        if (existingUser && existingUser.id) {
          await db.users.update(existingUser.id, {
            name: cleanName,
            role: 'volunteer',
            passkey: cleanPassword,
            syncStatus: 'pending',
          });
        } else {
          await db.users.add({
            identifier: cleanIdentifier,
            name: cleanName,
            role: 'volunteer',
            passkey: cleanPassword,
            passwordHash: cleanPassword,
            syncStatus: 'pending',
          } as any);
        }

        // Step B: Update Event Links & Assigned Desk
        for (const evId of targetEvents) {
          const now = Date.now();
          const userLinks = await db.managerEvents
            .where('managerIdentifier')
            .equals(cleanIdentifier)
            .toArray()
            .catch(() => []);

          const existingLink = userLinks.find((link) => Number(link.eventId) === Number(evId));

          if (existingLink && existingLink.id) {
            await db.managerEvents.update(existingLink.id, {
              assignedDesk: selectedDesk,
              assignedAt: existingLink.assignedAt || now,
              syncStatus: 'pending',
            });
          } else {
            await db.managerEvents.add({
              managerIdentifier: cleanIdentifier,
              eventId: evId,
              assignedDesk: selectedDesk,
              assignedAt: now,
              syncStatus: 'pending',
            });
          }
        }
      });

      setSuccessMsg(
        editingUserId
          ? `Volunteer '${cleanIdentifier}' updated successfully!`
          : `Volunteer account '${cleanIdentifier}' created and assigned!`
      );
      
      setTimeout(() => {
        setSuccessMsg('');
        resetForm();
        setActiveTab('list'); // Return to Active Roster after saving
      }, 1500);
    } catch (err: any) {
      console.error('❌ Failed to save volunteer account:', err);
      alert(`Error saving volunteer: ${err.message || 'IndexedDB Transaction Failed'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = isDark
    ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
    : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-blue-600';

  return (
    <div
      className={`p-8 rounded-3xl border max-w-2xl mx-auto w-full space-y-6 ${
        isDark ? 'bg-[#0a0f1d] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
      }`}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-4 border-inherit">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl">
            <UserCheck size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Volunteer Access Portal</h2>
            <p className="text-xs text-slate-400">Configure credentials, desk scope, and event rights</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10">
          <X size={18} />
        </button>
      </div>

      {/* VIEW / EDIT NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-inherit pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'list'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} />
          Active Roster ({volunteersList.length})
        </button>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setActiveTab('create');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'create'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {editingUserId ? <Edit2 size={14} /> : <PlusCircle size={14} />}
          {editingUserId ? 'Edit Volunteer' : 'Provision New'}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2">
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: ACTIVE VOLUNTEERS ROSTER LIST (DEFAULT OPEN VIEW) */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {volunteersList.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-xs text-slate-500 font-medium">
                No volunteer credentials provisioned yet.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('create');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all"
              >
                <PlusCircle size={14} /> Provision First Volunteer
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto p-1 custom-scrollbar">
              {volunteersList.map((vol) => (
                <div
                  key={vol.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{vol.name}</span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        @{vol.identifier}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-slate-400 uppercase font-black tracking-wider">
                      <span className="flex items-center gap-1">
                        <Shield size={10} className="text-purple-400" />
                        Desk: {vol.assignedDesk || 'CHECK_IN'}
                      </span>
                      <span>•</span>
                      <span>Assigned to {vol.assignedCount} events</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleEditVolunteer(vol)}
                    className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                    title="Edit Desk & Credentials"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE / EDIT VOLUNTEER FORM */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateOrUpdateVolunteer} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={volunteerName}
              onChange={(e) => setVolunteerName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${inputClass}`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Username / Identifier
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingUserId)}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. volunteer_rahul"
                className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${inputClass} disabled:opacity-50`}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Access Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${inputClass}`}
              />
            </div>
          </div>

          {/* DESK SELECTION SCOPE */}
          <div className="pt-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              Assigned Gate Station Desk
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDesk('CHECK_IN')}
                className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  selectedDesk === 'CHECK_IN'
                    ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : `${inputClass} opacity-60`
                }`}
              >
                Gate Check-In
              </button>

              <button
                type="button"
                onClick={() => setSelectedDesk('FOOD_CLAIM')}
                className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  selectedDesk === 'FOOD_CLAIM'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-600/20'
                    : `${inputClass} opacity-60`
                }`}
              >
                Food Stall
              </button>

              <button
                type="button"
                onClick={() => setSelectedDesk('ALL')}
                className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  selectedDesk === 'ALL'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : `${inputClass} opacity-60`
                }`}
              >
                Full Access
              </button>
            </div>
          </div>

          {/* EVENT ACCESS SCOPE ASSIGNMENT */}
          <div className="pt-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              Assigned Event Scope
            </label>

            <div className="flex items-center gap-4 mb-3">
              <button
                type="button"
                onClick={() => setAssignAll(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  assignAll ? 'bg-blue-600 border-blue-600 text-white' : `${inputClass} opacity-60`
                }`}
              >
                All Current & Future Events
              </button>
              <button
                type="button"
                onClick={() => setAssignAll(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  !assignAll ? 'bg-blue-600 border-blue-600 text-white' : `${inputClass} opacity-60`
                }`}
              >
                Select Specific Events
              </button>
            </div>

            {!assignAll && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-2xl border-inherit">
                {events.map((ev) => {
                  const numericEventId = Number(ev.id);
                  const isSelected = selectedEventIds.includes(numericEventId);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => handleToggleEvent(numericEventId)}
                      className={`p-3 text-left rounded-xl text-xs font-bold border flex items-center justify-between transition-all ${
                        isSelected ? 'bg-blue-600/10 border-blue-500 text-blue-400' : `${inputClass} opacity-70`
                      }`}
                    >
                      <span className="truncate">{ev.name}</span>
                      {isSelected && <Check size={14} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveTab('list');
              }}
              className="w-1/3 py-4 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all"
            >
              {isSaving
                ? 'Processing Credentials...'
                : editingUserId
                ? 'Update Volunteer Credentials'
                : 'Create & Provision Volunteer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}