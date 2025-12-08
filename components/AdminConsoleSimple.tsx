import React from 'react';

export const AdminConsoleSimple: React.FC = () => {
  return (
    <div className="p-6 bg-slate-800 rounded-xl">
      <h3 className="text-xl font-bold text-white mb-4">Admin Console - Test Version</h3>
      <p className="text-slate-300">If you can see this, the component is rendering correctly!</p>
      <div className="mt-4 p-4 bg-slate-900 rounded">
        <p className="text-green-400">✓ Component loaded successfully</p>
        <p className="text-slate-400 text-sm mt-2">The full Admin Console will load user data from Firebase.</p>
      </div>
    </div>
  );
};
