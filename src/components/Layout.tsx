import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0b0b0c] text-[#f2f2f3] flex flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
};
