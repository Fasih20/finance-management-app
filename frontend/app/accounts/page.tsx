"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { Sparkles, Plus, X, Landmark, MoreHorizontal } from "lucide-react";

export default function AccountsPage() {
  const { user, isLoaded } = useUser();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [manualBankName, setManualBankName] = useState("");
  const [manualBalance, setManualBalance] = useState("");

  useEffect(() => {
    async function loadAccounts() {
      if (!user?.id) return;
      try {
        const data = await fetchApi(`/accounts?userId=${user.id}`);
        setAccounts(data.accounts || []);
      } catch (error) {
        console.error("Failed to load accounts:", error);
      } finally {
        setLoading(false);
      }
    }
    if (isLoaded) loadAccounts();
  }, [user?.id, isLoaded]);

  // Account Creation Logic
  const handleCreateAccount = async (isDemo: boolean, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id) return;

    const payload = isDemo ? {
      userId: user.id,
      institutionName: "Demo Bank",
    } : {
      userId: user.id,
      institutionName: manualBankName || "Manual Account",
    };

    try {
      const data = await fetchApi("/accounts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAccounts((prev) => [...prev, data.account]);
      setIsAccountModalOpen(false);
      setManualBankName("");
      setManualBalance("");
    } catch (error) {
      alert("Failed to create account");
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* --- BLUE HEADER SECTION --- */}
      <div className="bg-blue-600 pb-36">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          
          {/* Top Nav */}
          <nav className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-8">
              <div className="text-white font-bold text-xl flex items-center gap-2">
                <Sparkles className="h-6 w-6" /> Finance
              </div>
              <div className="hidden md:flex space-x-4">
                <Link href="/dashboard" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Overview</Link>
                <Link href="/transactions" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Transactions</Link>
                <span className="bg-white/20 text-white px-3 py-1 rounded-md text-sm cursor-pointer">Accounts</span>
                <span className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Settings</span>
              </div>
            </div>
            <UserButton/>
          </nav>

          {/* Page Title & Action Button */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Accounts Page</h1>
              <p className="text-blue-200 text-sm">Manage your connected bank accounts and wallets</p>
            </div>
            <button 
              onClick={() => setIsAccountModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add new
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT (ACCOUNTS GRID) --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 pb-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
          
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
              <Landmark className="h-12 w-12 text-slate-300" />
              <p>No accounts connected yet.</p>
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Connect your first bank
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((acc) => (
                <div key={acc.id} className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow bg-slate-50 relative group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">{acc.name}</h3>
                  <p className="text-slate-500 text-sm mb-4">**** {acc.mask}</p>
                  <p className="text-3xl font-bold text-slate-900">
                    ${(acc.currentBalanceCents / 100).toFixed(2)}
                  </p>
                </div>
              ))}
              
              {/* "Add New" Card functioning as a button */}
              <div 
                onClick={() => setIsAccountModalOpen(true)}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all min-h-[200px]"
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="font-medium">Add New Account</span>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- ACCOUNT CREATION MODAL --- */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
            <button onClick={() => setIsAccountModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Add Bank Account</h2>
            
            <form onSubmit={(e) => handleCreateAccount(false, e)} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Institution Name</label>
                <input 
                  type="text" required value={manualBankName} onChange={(e) => setManualBankName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="e.g. Chase Bank, PayPal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Balance ($)</label>
                <input 
                  type="number" value={manualBalance} onChange={(e) => setManualBalance(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="2500.00"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Connect Account
              </button>
            </form>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">Or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button 
              onClick={() => handleCreateAccount(true)}
              className="w-full mt-4 bg-slate-100 text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
            >
              Generate Demo Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}