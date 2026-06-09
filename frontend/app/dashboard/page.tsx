"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { fetchApi } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Sparkles, Plus, X } from "lucide-react";
// import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  
  // Dashboard State
  const [plan, setPlan] = useState<string>("free");
  const [timeRange, setTimeRange] = useState("30"); // days
  const [insights, setInsights] = useState<string | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [manualBankName, setManualBankName] = useState("");
  const [manualBalance, setManualBalance] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      if (!user?.id) return;
      try {
        const accData = await fetchApi(`/accounts?userId=${user.id}`);
        const loadedAccounts = accData.accounts || [];
        setAccounts(loadedAccounts);

        const subData = await fetchApi(`/subscriptions?userId=${user.id}`);
        setPlan(subData.subscription?.planId || "free");

        // Fetch transactions for ALL accounts to get the global overview
        let allTxns: any[] = [];
        for (const acc of loadedAccounts) {
          const txData = await fetchApi(`/transactions?accountId=${acc.id}`);
          allTxns = [...allTxns, ...(txData.transactions || [])];
        }
        setTransactions(allTxns);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    if (isLoaded) loadInitialData();
  }, [user?.id, isLoaded]);

  // --- Calculations for Top Cards ---
  // Filter by timeRange (Simplified for now to just show all)
  const income = transactions.filter(t => t.amountCents > 0).reduce((sum, t) => sum + t.amountCents, 0);
  const expenses = transactions.filter(t => t.amountCents < 0).reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const remaining = income - expenses; // Using income and absolute expenses

  // --- Chart Data Preparation ---
  // 1. Area Chart (Income vs Expense over time)
  const chartDataMap: Record<string, { date: string, income: number, expenses: number }> = {};
  
  // Assuming transactions are sorted newest to oldest, we reverse them for left-to-right chronological charting
  [...transactions].reverse().forEach(t => {
    const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!chartDataMap[dateStr]) chartDataMap[dateStr] = { date: dateStr, income: 0, expenses: 0 };
    
    if (t.amountCents > 0) chartDataMap[dateStr].income += (t.amountCents / 100);
    else chartDataMap[dateStr].expenses += Math.abs(t.amountCents / 100);
  });
  const areaChartData = Object.values(chartDataMap);

  // 2. Pie Chart (Expenses by Category)
  const categoryMap: Record<string, number> = {};
  transactions.forEach(t => {
    if (t.amountCents < 0) {
      if (!categoryMap[t.category]) categoryMap[t.category] = 0;
      categoryMap[t.category] += Math.abs(t.amountCents / 100);
    }
  });
  
  const COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];
  const pieChartData = Object.keys(categoryMap).map((key, index) => ({
    name: key,
    value: categoryMap[key],
    color: COLORS[index % COLORS.length]
  }));

  // --- Account Creation Logic ---
  const handleCreateAccount = async (isDemo: boolean, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id) return;

    // If demo, use mock data. If manual, use state.
    const payload = isDemo ? {
      userId: user.id,
      institutionName: "Demo Bank",
    } : {
      userId: user.id,
      institutionName: manualBankName || "Manual Account",
      // We'd pass balance here if we updated the backend to accept initial balance
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

  const handleGetInsights = async () => {
    if (accounts.length === 0) return alert("Add an account first!");
    setGeneratingAI(true);
    try {
      // Just grabbing insights based on the first account for the dashboard overview
      const data = await fetchApi(`/summary?accountId=${accounts[0].id}`);
      setInsights(data.insights);
    } catch (error) {
      setInsights("Failed to connect to AI service.");
    } finally {
      setGeneratingAI(false);
    }
  };

  if (!isLoaded || loading) return <div className="p-8 text-center text-slate-500">Loading your finances...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* --- BLUE HEADER SECTION --- */}
      <div className="bg-blue-600 pb-36">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          
          {/* Top Nav (Mockup) */}
          <nav className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-8">
              <div className="text-white font-bold text-xl flex items-center gap-2">
                <Sparkles className="h-6 w-6" /> Finance
              </div>
              <div className="hidden md:flex space-x-4">
                <span className="bg-white/20 text-white px-3 py-1 rounded-md text-sm cursor-pointer">Overview</span>
                <Link href="/transactions" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Transactions</Link>
                <Link href="/accounts" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Accounts</Link>
                <Link href="/settings" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Settings</Link>
              </div>
            </div>
            <UserButton/>
          </nav>

          {/* Welcome & Filters */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Welcome Back, 👋</h1>
              <p className="text-blue-200 text-sm">This is your Financial Overview Report</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsAccountModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Account
              </button>
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white/10 text-white border border-white/20 rounded-md px-3 py-2 text-sm focus:outline-none"
              >
                <option value="30" className="text-black">Last 30 Days</option>
                <option value="90" className="text-black">Last 90 Days</option>
                <option value="all" className="text-black">All Time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT OVERLAPPING HEADER --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 space-y-6 pb-12">
        
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-600 font-medium">Remaining</h3>
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><PiggyBank className="h-5 w-5" /></div>
            </div>
            <p className="text-3xl font-bold text-slate-900">${(remaining / 100).toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-600 font-medium">Income</h3>
              <div className="p-2 bg-green-100 rounded-lg text-green-600"><ArrowUpRight className="h-5 w-5" /></div>
            </div>
            <p className="text-3xl font-bold text-slate-900">${(income / 100).toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-slate-600 font-medium">Expenses</h3>
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><ArrowDownRight className="h-5 w-5" /></div>
            </div>
            <p className="text-3xl font-bold text-slate-900">${(expenses / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* CHARTS & AI SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold text-slate-800">Transactions</h2>
            </div>
            <div className="flex-1 w-full h-[300px]">
              {areaChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} />
                    <Tooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 min-h-[250px]">
  <h2 className="font-semibold text-slate-800 mb-2">Categories</h2>

  {pieChartData.length === 0 ? (
    <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
      No expenses to categorize
    </div>
  ) : (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={pieChartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {pieChartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>

        <Tooltip
          formatter={(value) => `$${Number(value).toFixed(2)}`}
        />
      </PieChart>
    </ResponsiveContainer>
  )}
</div>

            {/* AI Summary Widget */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 shadow-sm text-white">
              <h2 className="font-bold mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5"/> AI Financial Assistant</h2>
              {plan === "free" ? (
                <p className="text-sm text-indigo-100 mb-4">Upgrade to Pro to unlock personalized Gemini insights.</p>
              ) : (
                <div className="space-y-4">
                  <button 
                    onClick={handleGetInsights} disabled={generatingAI}
                    className="w-full bg-white text-indigo-600 font-semibold py-2 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    {generatingAI ? "Analyzing..." : "Generate AI Summary"}
                  </button>
                  {insights && <div className="text-sm bg-black/20 p-4 rounded-lg border border-white/10 leading-relaxed">{insights}</div>}
                </div>
              )}
            </div>
          </div>

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