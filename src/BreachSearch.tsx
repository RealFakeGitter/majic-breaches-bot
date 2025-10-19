import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function BreachSearch() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchBreaches = useMutation(api.breaches.searchBreaches);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const result = await searchBreaches({
        query: query.trim(),
        limit: 500,
        platform: "web"
      });

      if (result.searchId) {
        navigate(`/search-results?id=${result.searchId}`);
      } else {
        toast.error("Search failed - no results returned");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Search Data Breaches</h2>
      
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter email, username, password, phone, IP, or any keyword..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSearching}
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Search across multiple data breach databases for security research purposes.</p>
      </div>
    </div>
  );
}
