"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { Sparkles, Search, Filter, ArrowUpDown, Plus, X } from "lucide-react";

export default function TransactionsPage() {
  const { user, isLoaded } = useUser();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // --- NEW: Transaction Modal State ---
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [newTxnAccountId, setNewTxnAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      try {
        setLoading(true);
        // 1. Fetch Accounts
        const accData = await fetchApi(`/accounts?userId=${user.id}`);
        const loadedAccounts = accData.accounts || [];
        setAccounts(loadedAccounts);
        
        // Default the modal dropdown to the first account if available
        if (loadedAccounts.length > 0) {
          setNewTxnAccountId(loadedAccounts[0].id);
        }

        // 2. Fetch Transactions
        let allTxns: any[] = [];
        if (selectedAccountId === "all") {
          for (const acc of loadedAccounts) {
            const txData = await fetchApi(`/transactions?accountId=${acc.id}`);
            const txnsWithAccount = (txData.transactions || []).map((t: any) => ({...t, accountName: acc.name}));
            allTxns = [...allTxns, ...txnsWithAccount];
          }
        } else {
          const txData = await fetchApi(`/transactions?accountId=${selectedAccountId}`);
          const account = loadedAccounts.find((a: any) => a.id === selectedAccountId);
          allTxns = (txData.transactions || []).map((t: any) => ({...t, accountName: account?.name || "Unknown"}));
        }

        // Sort newest first
        allTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(allTxns);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded) fetchData();
  }, [user?.id, isLoaded, selectedAccountId]);

  // --- NEW: Handle Adding a Transaction ---
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxnAccountId || !amount) return;

    // Convert dollars to cents for the database
    const amountCents = Math.round(parseFloat(amount) * 100);

    try {
      const data = await fetchApi("/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: newTxnAccountId,
          amountCents,
          category,
          description,
          date: date || undefined // If date is empty, backend uses defaultNow()
        }),
      });
      
      // Find account name for immediate UI update
      const targetAccount = accounts.find(a => a.id === newTxnAccountId);
      const newTxnUI = { ...data.transaction, accountName: targetAccount?.name || "Unknown" };

      // Update the table immediately
      setTransactions((prev) => [newTxnUI, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
      // Close and reset modal
      setIsTxnModalOpen(false);
      setAmount("");
      setDescription("");
      setDate("");
    } catch (error) {
      alert("Failed to add transaction");
    }
  };

  // Apply local search filter
  const filteredTransactions = transactions.filter(t => 
    (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     t.category?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* --- BLUE HEADER SECTION --- */}
      <div className="bg-blue-600 pb-36">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          
          <nav className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-8">
              <div className="text-white font-bold text-xl flex items-center gap-2">
                <Sparkles className="h-6 w-6" /> Finance
              </div>
              <div className="hidden md:flex space-x-4">
                <Link href="/dashboard" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Overview</Link>
                <span className="bg-white/20 text-white px-3 py-1 rounded-md text-sm cursor-pointer">Transactions</span>
                <Link href="/accounts" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Accounts</Link>
                <Link href="/settings" className="text-blue-100 hover:text-white px-3 py-1 text-sm cursor-pointer transition-colors">Settings</Link>
              </div>
            </div>
            <UserButton/>
          </nav>

          {/* Page Title & Add Button */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Transaction History</h1>
              <p className="text-blue-200 text-sm">View and filter all your financial activities</p>
            </div>
            <button 
              onClick={() => setIsTxnModalOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-md text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Transaction
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT (DATA TABLE) --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 pb-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search transactions..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400" />
              <select 
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full sm:w-auto border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (***{acc.mask})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2">Date <ArrowUpDown className="h-3 w-3"/></div>
                  </th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Account</th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="flex items-center justify-end gap-2">Amount <ArrowUpDown className="h-3 w-3"/></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Loading transactions...</td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No transactions found.</td>
                  </tr>
                ) : (
                  filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-900">
                        {new Date(txn.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {txn.description || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                          {txn.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {txn.accountName}
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap ${txn.amountCents > 0 ? 'text-green-600' : 'text-slate-900'}`}>
                        {txn.amountCents > 0 ? '+' : ''}{(txn.amountCents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- ADD TRANSACTION MODAL --- */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
            <button onClick={() => setIsTxnModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Add Transaction</h2>
            
            {accounts.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <p>You need to connect an account first!</p>
                <Link href="/accounts" className="text-blue-600 font-medium mt-2 block hover:underline">Go to Accounts</Link>
              </div>
            ) : (
              <form onSubmit={handleAddTransaction} className="space-y-4 mb-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                  <select 
                    value={newTxnAccountId} onChange={(e) => setNewTxnAccountId(e.target.value)} required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                    <input 
                      type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      placeholder="-15.50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input 
                      type="date" value={date} onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select 
                    value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option>Food</option>
                    <option>Rent</option>
                    <option>Salary</option>
                    <option>Entertainment</option>
                    <option>Utilities</option>
                    <option>Shopping</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input 
                    type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    placeholder="Coffee shop, groceries, etc."
                  />
                </div>
                
                <button type="submit" className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors mt-2">
                  Save Transaction
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}