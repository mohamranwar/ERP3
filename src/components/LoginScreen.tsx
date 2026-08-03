/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Crown, ClipboardList, Eye, Boxes } from 'lucide-react';

const ROLE_META: Record<string, { icon: any; badgeClass: string; description: string }> = {
  admin: {
    icon: Crown,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Full access - create, edit, delete, and manage the Supabase connection.'
  },
  planner: {
    icon: ClipboardList,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Can create and edit plans, master data, and purchase orders.'
  },
  viewer: {
    icon: Eye,
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    description: 'Read-only access across every screen.'
  }
};

export default function LoginScreen() {
  const { users, loading, login } = useAuth();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 p-4" id="login_screen">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-8 py-7 bg-slate-900 text-white space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <h1 className="text-sm font-extrabold uppercase tracking-wider">Sanita Supply Planner</h1>
          </div>
          <p className="text-xs text-slate-400">Select an account to continue. This offline demo doesn't use passwords - roles gate what each account can edit.</p>
        </div>

        <div className="p-5 space-y-2.5">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          )}

          {!loading && users.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">No accounts configured. Connect Supabase or reload the app to reseed demo accounts.</p>
          )}

          {!loading && users.map(u => {
            const meta = ROLE_META[u.role] || ROLE_META.viewer;
            const Icon = meta.icon;
            return (
              <button
                key={u.id}
                id={`login_user_${u.id}`}
                onClick={() => login(u.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-start cursor-pointer group"
              >
                <div className={`p-2 rounded-lg border shrink-0 ${meta.badgeClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{u.name}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                      {u.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                </div>
                <ShieldCheck className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Running in Sandboxed Local Mode. Connect a Supabase project from the Database Engine panel after signing in to swap this for real accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
