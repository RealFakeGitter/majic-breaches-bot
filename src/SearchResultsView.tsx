import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useSearchParams, Link } from "react-router-dom";
import { Id } from "../convex/_generated/dataModel";

export function SearchResultsView() {
  console.log("🔍 SearchResultsView component is rendering!");
  
  const [searchParams] = useSearchParams();
  const searchIdParam = searchParams.get("id");
  
  console.log("SearchResultsView - URL searchParams:", Object.fromEntries(searchParams.entries()));
  console.log("SearchResultsView - extracted searchIdParam:", searchIdParam);

  // Convert string to proper Convex ID type
  const searchId = searchIdParam as Id<"searches"> | null;
  
  console.log("SearchResultsView - searchId being used:", searchId);
  
  const searchData = useQuery(
    api.breaches.getSearchResults,
    searchId ? { searchId } : "skip"
  );

  // Debug query to check if searchId exists
  const debugSearch = useQuery(
    api.breaches.debugSearch,
    searchId ? { searchId } : "skip"
  );

  // Debug query to see all searches
  const allSearches = useQuery(api.breaches.getAllSearches);

  console.log("SearchResultsView - searchData:", searchData);
  console.log("SearchResultsView - debugSearch:", debugSearch);
  console.log("SearchResultsView - allSearches:", allSearches);

  const searchResults = searchData?.results || [];
  const searchInfo = searchData?.search;

  if (!searchId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Invalid Search</h1>
          <p className="text-gray-600 mb-6">No search ID provided in the URL.</p>
          <Link
            to="/"
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (searchData === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading search results...</p>
          <div className="mt-4 text-xs text-gray-500">
            <p>Search ID: {searchId}</p>
            <p>Debug: {debugSearch ? JSON.stringify(debugSearch) : "Loading debug..."}</p>
            <p>All searches: {allSearches?.length || 0} found</p>
          </div>
        </div>
      </div>
    );
  }

  if (searchData === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Search Not Found</h1>
          <p className="text-gray-600 mb-6">Search ID: {searchId}</p>
          <p className="text-sm text-gray-500">All searches: {allSearches?.length || 0}</p>
          <Link to="/" className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (!searchResults || searchResults.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">No Results Found</h1>
          <p className="text-gray-600 mb-6">
            No breach data found for query: <strong>{searchInfo?.query || "Unknown"}</strong>
          </p>
          <Link
            to="/"
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Another Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Search Results</h1>
              <p className="text-gray-600 mt-1">
                Query: <span className="font-medium">{searchInfo?.query}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{searchResults.length}</div>
              <div className="text-sm text-gray-500">Results Found</div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {searchResults.map((result, index) => (
            <div key={result._id} className="bg-white rounded-lg shadow-sm border p-6">
              {/* Breach Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {index + 1}. {result.breachName}
                  </h2>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {result.breachDate && (
                      <span className="flex items-center">
                        📅 <span className="ml-1">{result.breachDate}</span>
                      </span>
                    )}
                    <span className="flex items-center">
                      🎯 <span className="ml-1">Matched: {result.matchedField}</span>
                    </span>
                    {result.recordCount && (
                      <span className="flex items-center">
                        📊 <span className="ml-1">{result.recordCount.toLocaleString()} records</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Types */}
              {result.dataTypes && result.dataTypes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Data Fields:</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.dataTypes.map((type, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {result.breachDescription && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description:</h3>
                  <p className="text-sm text-gray-600">{result.breachDescription}</p>
                </div>
              )}

              {/* Content */}
              {result.content && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Breach Data:</h3>
                  <div className="bg-gray-50 rounded-md p-4 overflow-x-auto">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                      {result.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="font-semibold text-yellow-800 mb-2">Important Disclaimer</h3>
            <p className="text-yellow-700 text-sm">
              This data is provided for educational and security research purposes only. 
              Please use responsibly and in accordance with applicable laws and regulations.
            </p>
          </div>
          
          <Link
            to="/"
            className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            🔍 Search Again
          </Link>
        </div>
      </div>
    </div>
  );
}
