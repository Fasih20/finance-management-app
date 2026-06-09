"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser, UserProfile } from "@clerk/nextjs";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { Sparkles, CreditCard, Moon, Sun, Monitor, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubscription() {
      if (!user?.id) return;
      try {
        const subData = await fetchApi(`/subscriptions?userId=${user.id}`);
        setPlan(subData.subscription?.planId || "free");
      } catch (error) {
        console.error("Failed to load subscription:", error);
      } finally {
        setLoading(false);
      }
    }
    if (isLoaded) loadSubscription();
  }, [user?.id, isLoaded]);

  const handleUpgrade = async () => {
    if (!user?.id) return;
    try {
      const data = await fetchApi("/subscriptions/billing", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, action: plan === "free" ? "upgrade" : "cancel" }),
      });
      setPlan(data.subscription.planId);
      alert(data.message);
    } catch (error) {
      alert("Billing process failed.");
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
                <Link href="/accounts" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Accounts</Link>
                <span className="bg-white/20 text-white px-3 py-1 rounded-md text-sm cursor-pointer">Settings</span>
              </div>
            </div>
            <UserButton/>
          </nav>

          {/* Page Title */}
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
            <p className="text-blue-200 text-sm">Manage your account, billing, and preferences</p>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 pb-12 space-y-6">
        
        {/* Billing & Subscription */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-800">Subscription & Billing</h2>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-slate-200 rounded-lg bg-slate-50">
            <div>
              <p className="font-medium text-slate-900 flex items-center gap-2">
                Current Plan: <span className="uppercase tracking-wider text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">{plan}</span>
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {plan === "pro" 
                  ? "You have full access to AI financial insights and unlimited transaction history." 
                  : "Upgrade to Pro to unlock AI financial insights and advanced charting."}
              </p>
            </div>
            <button 
              onClick={handleUpgrade}
              className={`mt-4 md:mt-0 px-4 py-2 rounded-lg font-medium transition-colors ${
                plan === "free" 
                  ? "bg-blue-600 text-white hover:bg-blue-700" 
                  : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {plan === "free" ? "Upgrade to Pro" : "Cancel Subscription"}
            </button>
          </div>
        </div>

        {/* Appearance (Mock UI for now) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-800">Appearance</h2>
          </div>
          <div className="flex gap-4">
            <button className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-blue-600 bg-blue-50 rounded-xl text-blue-700 font-medium">
              <Sun className="h-6 w-6 mb-2" /> Light
            </button>
            <button className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-slate-200 hover:border-slate-300 rounded-xl text-slate-600 font-medium opacity-50 cursor-not-allowed">
              <Moon className="h-6 w-6 mb-2" /> Dark (Coming Soon)
            </button>
          </div>
        </div>

        {/* Profile Management via Clerk */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-800">Security & Profile</h2>
          </div>
          {/* We wrap the UserProfile to hide the default Clerk routing layout that clashes with our page */}
          <div className="w-full flex justify-center [&>.cl-rootBox]:w-full [&_.cl-card]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-card]:border-slate-200">
             <UserProfile routing="hash" />
          </div>
        </div>

      </main>
    </div>
  );
}