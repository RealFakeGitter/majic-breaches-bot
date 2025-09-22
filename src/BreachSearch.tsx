import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export function BreachSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(100);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<Id<"searches"> | null>(null);

  const searchBreaches = useAction(api.breaches.searchBreaches);
  const searchResults = useQuery(
    api.breaches.getSearchResults,
    currentSearchId ? { searchId: currentSearchId } : "skip"
  );
  const userSearches = useQuery(api.auth.loggedInUser) ? useQuery(api.breaches.getUserSearches) : [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchBreaches({
        query: searchQuery.trim(),
        limit: searchLimit,
      });
      
      setCurrentSearchId(result.searchId);
      toast.success(`Search completed! Found ${result.resultCount} results`);
    } catch (error) {
      toast.error(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePreviousSearch = (searchId: Id<"searches">) => {
    setCurrentSearchId(searchId);
  };

  return (
    <div className="space-y-8">
      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Query
            </label>
            <input
              id="search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter email, username, password, phone, IP, name, or any keyword..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSearching}
            />
            <p className="text-sm text-gray-500 mt-1">
              Examples: joe@test.com, john.doe, 192.168.1.1, +1234567890, "John Smith"
            </p>
          </div>

          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-2">
              Search Limit
            </label>
            <select
              id="limit"
              value={searchLimit}
              onChange={(e) => setSearchLimit(Number(e.target.value))}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
              disabled={isSearching}
            >
              <option value={100}>100 results</option>
              <option value={500}>500 results</option>
              <option value={1000}>1,000 results</option>
              <option value={5000}>5,000 results</option>
              <option value={10000}>10,000 results</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? "Searching..." : "Search Breaches"}
          </button>
        </form>
      </div>

      {/* Previous Searches */}
      {userSearches && userSearches.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Searches</h3>
          <div className="space-y-2">
            {userSearches.map((search) => (
              <button
                key={search._id}
                onClick={() => handlePreviousSearch(search._id)}
                className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{search.query}</span>
                  <div className="text-sm text-gray-500">
                    <span className="mr-4">{search.resultCount} results</span>
                    <span>{new Date(search.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">
              Search Results for "{searchResults.search.query}"
            </h3>
            <span className="text-sm text-gray-500">
              {searchResults.results.length} results found
            </span>
          </div>

          {searchResults.results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No results found for this search query.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {searchResults.results.map((result, index) => (
                <div key={result._id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-lg text-blue-600">
                        {result.breachName}
                      </h4>
                      {result.breachDescription && (
                        <p className="text-sm text-gray-600 mt-1">
                          {result.breachDescription}
                        </p>
                      )}
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Match: {result.matchedField}
                    </span>
                  </div>

                  <div className="bg-white rounded border p-4">
                    <h5 className="font-medium mb-2">Breach Data:</h5>
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-100 p-3 rounded overflow-x-auto">
                      {result.content}
                    </pre>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.dataTypes.map((dataType) => (
                      <span
                        key={dataType}
                        className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                      >
                        {dataType}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
