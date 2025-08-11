// components/Header.tsx
import React, { useState } from 'react';
import Logo from './Logo';

export default function Header() {
  const [search, setSearch] = useState('');
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-6 bg-gray-900 border-b border-gray-700">
      {/* logo + beta */}
      <div className="relative flex-shrink-0">
        {/* logo is 48px tall → 64px on md+ */}
        <Logo className="h-12 w-auto md:h-16" />
        {/* beta is 12px, tucked into top‐right corner */}
        <span
          className="
            absolute top-0 right-0 
            text-xs font-bold text-white 
            transform translate-x-1/2 -translate-y-1/2
            bg-gray-900 px-1
          "
        >
          BETA
        </span>
      </div>

  
    </header>
  );
}
