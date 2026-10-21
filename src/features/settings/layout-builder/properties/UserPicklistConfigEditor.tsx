"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { FormField } from "@/lib/layout-builder/types";
import type { BuilderUser } from "../useLayoutBuilder";

interface UserPicklistConfigEditorProps {
  field: FormField;
  users: BuilderUser[];
  onChange: (updates: Partial<FormField>) => void;
}

const FALLBACK_ROLES = [{ key: "ADMIN", name: "Admin" }, { key: "MANAGER", name: "Manager" }, { key: "STAFF", name: "Staff" }];

/** USER_PICKLIST / MULTI_USER_PICKLIST: which users the pick-list offers, and availability display. */
export default function UserPicklistConfigEditor({ field: selectedField, users: allUsers, onChange: updateSelectedField }: UserPicklistConfigEditorProps) {
  const { data } = useSWR<{ roles: { key: string; name: string }[] }>("/api/roles", fetcher, { revalidateOnFocus: false });
  const roleOptions = data?.roles ?? FALLBACK_ROLES;
  return (
    <div className="pt-4 border-t border-gray-100">
      <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1 mb-3">
        User Pick List Values
      </label>
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="upConfigMode" className="accent-orange-500 w-4 h-4" checked={!selectedField.userPicklistConfig || selectedField.userPicklistConfig.mode === 'ALL'} onChange={() => updateSelectedField({ userPicklistConfig: { mode: 'ALL', roles: [], userIds: [] } })} />
          <span className="text-sm font-semibold text-slate-700">All Users</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="upConfigMode" className="accent-orange-500 w-4 h-4" checked={selectedField.userPicklistConfig?.mode === 'ROLES'} onChange={() => updateSelectedField({ userPicklistConfig: { mode: 'ROLES', roles: selectedField?.userPicklistConfig?.roles || [], userIds: [] } })} />
          <span className="text-sm font-semibold text-slate-700">Select Roles</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="upConfigMode" className="accent-orange-500 w-4 h-4" checked={selectedField.userPicklistConfig?.mode === 'USERS'} onChange={() => updateSelectedField({ userPicklistConfig: { mode: 'USERS', roles: [], userIds: selectedField?.userPicklistConfig?.userIds || [] } })} />
          <span className="text-sm font-semibold text-slate-700">Select Users</span>
        </label>
      </div>

      <div className="flex items-center justify-between py-3 border-y border-gray-100 mb-4">
        <span className="text-[0.8rem] font-bold text-slate-700">Show User Availability</span>
        <div
          onClick={() => {
            const currentConfig = selectedField.userPicklistConfig || { mode: 'ALL', roles: [], userIds: [] };
            updateSelectedField({
              userPicklistConfig: {
                ...currentConfig,
                showAvailability: !currentConfig.showAvailability
              }
            });
          }}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${selectedField.userPicklistConfig?.showAvailability ? 'bg-orange-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.userPicklistConfig?.showAvailability ? 'translate-x-5' : 'translate-x-0'}`}></span>
        </div>
      </div>

      {(!selectedField.userPicklistConfig || selectedField.userPicklistConfig.mode === 'ALL') && (
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 text-sm font-semibold text-slate-500 text-center">
          The pick-list will include all project users.
        </div>
      )}

      {selectedField.userPicklistConfig?.mode === 'ROLES' && (
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          {roleOptions.map(({ key: role, name }) => (
            <label key={role} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-orange-500 w-4 h-4 rounded"
                checked={selectedField.userPicklistConfig?.roles?.includes(role) || false}
                onChange={(e) => {
                  const currentRoles = selectedField?.userPicklistConfig?.roles || [];
                  const newRoles = e.target.checked ? [...currentRoles, role] : currentRoles.filter(r => r !== role);
                  updateSelectedField({ userPicklistConfig: { ...selectedField.userPicklistConfig!, roles: newRoles } });
                }}
              />
              <span className="text-sm font-semibold text-slate-700">{name}</span>
            </label>
          ))}
        </div>
      )}

      {selectedField.userPicklistConfig?.mode === 'USERS' && (
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 max-h-[200px] overflow-y-auto flex flex-col gap-3">
          {(!allUsers || allUsers.length === 0) && <span className="text-sm text-slate-400">Loading users...</span>}
          {allUsers.map(user => (
            <label key={user.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-orange-500 w-4 h-4 rounded"
                checked={selectedField.userPicklistConfig?.userIds?.includes(user.id) || false}
                onChange={(e) => {
                  const currentUserIds = selectedField?.userPicklistConfig?.userIds || [];
                  const newUserIds = e.target.checked ? [...currentUserIds, user.id] : currentUserIds.filter(id => id !== user.id);
                  updateSelectedField({ userPicklistConfig: { ...selectedField.userPicklistConfig!, userIds: newUserIds } });
                }}
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700">{user.name}</span>
                <span className="text-[0.6rem] font-bold text-slate-400 uppercase">{user.roleName ?? user.role}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
