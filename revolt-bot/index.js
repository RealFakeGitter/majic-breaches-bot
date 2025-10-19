import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Toaster } from "sonner";
import { Routes, Route } from "react-router-dom";
import { BotInvites } from "./BotInvites";
import { BreachSearch } from "./BreachSearch";
import { ResultsPage } from "./ResultsPage";
import { SearchResultsView } from "./SearchResultsView";

export default function App() {
  console.log("🚀 App component is rendering!");
  console.log("Current URL:", window.location.href);
  console.log("Current pathname:", window.location.pathname);
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm h-16 flex justify-center items-center border-b shadow-sm">
        <h2 className="text-2xl font-bold text-blue-600">🔍 Majic Breaches Bot</h2>
      </header>
      <main className="flex-1 p-8">
        <Routes>
          <Route path="/" element={<Content />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/search-results" element={<SearchResultsView />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const botStats = useQuery(api.bots.getBotStats);
  const allSearches = useQuery(api.breaches.getAllSearches);

  console.log("All searches from database:", allSearches);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-blue-600 mb-6">Majic Breaches</h1>
        <p className="text-2xl text-gray-700 mb-4">
          Search Data Breaches & Add Bots to Your Servers
        </p>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Search across data breaches for usernames, emails, passwords, and more. 
          Use the web interface below or add our bot to Discord/Revolt servers.
        </p>
      </div>

      {/* Main Breach Search Interface */}
      <BreachSearch />

      {/* Bot Statistics */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Bot Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {botStats ? botStats.totalSearches.toLocaleString() : "0"}
            </div>
            <div className="text-gray-600">Total Searches</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {botStats ? botStats.totalResults.toLocaleString() : "0"}
            </div>
            <div className="text-gray-600">Results Found</div>
          </div>
        </div>
      </div>



      {/* Bot Invites */}
      <BotInvites />

      {/* Features */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="text-center p-4">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-semibold mb-2">Advanced Search</h3>
            <p className="text-gray-600 text-sm">
              Search by email, username, password, phone, IP, or any keyword
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-semibold mb-2">Fast Results</h3>
            <p className="text-gray-600 text-sm">
              Get instant results from multiple breach databases
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="font-semibold mb-2">Secure & Private</h3>
            <p className="text-gray-600 text-sm">
              All searches are ephemeral and not logged permanently
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold mb-3">Detailed Results</h3>
            <p className="text-gray-600 text-sm">
              See breach names, dates, and matched data fields
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-semibold mb-2">OSINT Ready</h3>
            <p className="text-gray-600 text-sm">
              Perfect for security research and investigations
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold mb-2">Easy Commands</h3>
            <p className="text-gray-600 text-sm">
              Simple slash commands and text commands
            </p>
          </div>
        </div>
      </div>

      {/* Commands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Discord Commands */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold">D</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Discord Commands</h2>
          </div>
          <div className="space-y-4">
            <div>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                /search &lt;query&gt; [limit]
              </code>
              <p className="text-gray-600 text-sm mt-1">Search for breaches</p>
            </div>
            <div>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                /stats
              </code>
              <p className="text-gray-600 text-sm mt-1">Show bot statistics</p>
            </div>
            <div>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                /help
              </code>
              <p className="text-gray-600 text-sm mt-1">Show help message</p>
            </div>
          </div>
        </div>

        {/* Revolt Commands */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold">R</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Revolt Commands</h2>
          </div>
          <div className="space-y-4">
            <div>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                !breach search &lt;query&gt;
              </code>
              <p className="text-gray-600 text-sm mt-1">Search for breaches</p>
            </div>
            <div>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                !breach stats
              </code>
              <p className="text-gray-600 text-sm mt-1">Show bot statistics</p>
            </div>
            <div>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                !breach help
              </code>
              <p className="text-gray-600 text-sm mt-1">Show help message</p>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">⚠️</div>
        <h3 className="font-semibold text-yellow-800 mb-2">Important Disclaimer</h3>
        <p className="text-yellow-700 text-sm">
          This bot is intended for educational and security research purposes only. 
          Please use responsibly and in accordance with applicable laws and regulations.
        </p>
      </div>
    </div>
  );
}
