import { Headphones } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
      <div className="bg-blue-600 p-2 rounded-lg">
        <Headphones className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Call Audit AI</h1>
        <p className="text-sm text-gray-500">Deep real-time and post-call analysis</p>
      </div>
    </header>
  );
}
