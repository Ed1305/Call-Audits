export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
      <div className="flex-shrink-0">
        <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Document Base */}
          <path d="M15 15C15 9.477 19.477 5 25 5H65L85 25V85C85 90.523 80.523 95 75 95H25C19.477 95 15 90.523 15 85V15Z" fill="#02004D" stroke="#8B8CFF" strokeWidth="4" strokeLinejoin="round"/>
          {/* Fold */}
          <path d="M65 5V15C65 20.523 69.477 25 75 25H85" fill="#02004D" stroke="#8B8CFF" strokeWidth="4" strokeLinejoin="round"/>
          {/* Lines */}
          <line x1="25" y1="25" x2="50" y2="25" stroke="#8B8CFF" strokeWidth="6" strokeLinecap="round"/>
          <line x1="25" y1="38" x2="70" y2="38" stroke="#8B8CFF" strokeWidth="6" strokeLinecap="round"/>
          <line x1="25" y1="51" x2="70" y2="51" stroke="#8B8CFF" strokeWidth="6" strokeLinecap="round"/>
          {/* Banner */}
          <rect x="5" y="62" width="90" height="34" rx="8" fill="#02004D" stroke="#8B8CFF" strokeWidth="4"/>
          {/* Text */}
          <text x="50" y="88" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="26" fill="#8B8CFF" textAnchor="middle">Au</text>
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Call Audit</h1>
        <p className="text-sm text-gray-500">Deep real-time and post-call analysis</p>
      </div>
    </header>
  );
}
