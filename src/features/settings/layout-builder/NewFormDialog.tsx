"use client";

interface NewFormDialogProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}

export default function NewFormDialog({ name, description, onNameChange, onDescriptionChange, onCancel, onCreate }: NewFormDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="relative bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-gray-100 w-full max-w-[450px] mx-4 overflow-hidden animate-fade-in p-7">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Create New Form</h3>
        <p className="text-sm text-slate-500 mb-6">Define a new dynamic form to collect custom information.</p>
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Form Name</label>
            <input
              type="text"
              value={name ?? ''}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Employee Feedback"
              className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-400 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              value={description ?? ''}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What is this form used for?"
              rows={2}
              className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-orange-400 focus:bg-white transition-colors resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onCreate} disabled={!name} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Create Form</button>
        </div>
      </div>
    </div>
  );
}
