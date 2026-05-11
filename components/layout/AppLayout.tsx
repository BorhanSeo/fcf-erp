"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Profile } from "@/types";
import { useSettingsStore } from "@/store/settingsStore";
import { useEffect, useRef } from "react";

interface AppLayoutProps {
  user: Profile;
  settings?: Record<string, string>;
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function AppLayout({ user, settings, children, breadcrumbs }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const initialized = useRef(false);

  if (!initialized.current && settings) {
    setSettings(settings);
    initialized.current = true;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — Desktop */}
      <div className={`hidden lg:flex flex-shrink-0 h-full z-20 transition-all duration-300 ${sidebarCollapsed ? "w-[70px]" : "w-[250px]"}`}>
        <Sidebar
          role={user.role}
          collapsed={sidebarCollapsed}
        />
      </div>

      {/* Sidebar — Mobile (overlay) */}
      <div className={`fixed inset-y-0 left-0 z-40 lg:hidden transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar
          role={user.role}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          breadcrumbs={breadcrumbs}
        />

        {/* Collapse toggle for desktop */}
        <div className="hidden lg:block relative">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-10 bg-white border border-slate-200 border-l-0 rounded-r-full flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm"
            style={{ left: sidebarCollapsed ? "70px" : "250px" }}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`w-3 h-3 text-slate-400 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
