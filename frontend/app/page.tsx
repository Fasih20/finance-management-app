import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Sparkles, TrendingUp, ShieldCheck, ArrowRight, BrainCircuit } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200">
      
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <Sparkles className="h-6 w-6" /> Finance AI
          </div>
          
          <div className="flex items-center gap-4">
            {userId ? (
              <>
                <Link href="/dashboard" className="font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                  Dashboard
                </Link>
                <UserButton/>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="font-medium text-slate-600 hover:text-blue-600 transition-colors">
                  Sign In
                </Link>
                <Link href="/sign-up" className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium mb-8">
          <Sparkles className="h-4 w-4" /> Introducing AI Financial Insights
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6">
          Master your money <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            with intelligent insights.
          </span>
        </h1>
        
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Connect your accounts, track your spending automatically, and let Google Gemini analyze your financial health to help you save more.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href={userId ? "/dashboard" : "/sign-up"} className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-600/20 flex items-center justify-center gap-2">
            {userId ? "Go to your Dashboard" : "Start Tracking for Free"} 
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </main>

      {/* Features Grid */}
      <section className="bg-white py-24 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to build wealth</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Stop guessing where your money goes. Get crystal clear visibility into your financial life.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Automated Tracking</h3>
              <p className="text-slate-600 leading-relaxed">Connect your bank accounts securely and watch your transactions categorize themselves in real-time.</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Financial Advisor</h3>
              <p className="text-slate-600 leading-relaxed">Get personalized summaries and actionable money-saving tips powered by advanced generative AI.</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Bank-Grade Security</h3>
              <p className="text-slate-600 leading-relaxed">Your data is encrypted and securely stored. We never sell your personal financial information to third parties.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
