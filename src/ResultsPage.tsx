import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useSearchParams, Link } from "react-router-dom";
import { Id } from "../convex/_generated/dataModel";

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get("searchId") as Id<"searches"> | null;

  const searchData = useQuery(
    api.breaches.getSearchResults,
    searchId ? { searchId } : "skip"
  );

  if (!searchId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Invalid Search</h1>
          <p className="text-gray-600 mb-6">No search ID provided.</p>
          <Link to="/" className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (searchData === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (searchData === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Search Not Found</h1>
          <Link to="/" className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Search Results</h1>
        <p className="text-gray-600 mb-8">
          Query: <span className="font-medium">{searchData.search?.query}</span>
        </p>
        
        {searchData.results && searchData.results.length > 0 ? (
          <div className="space-y-4">
            {searchData.results.map((result, index) => (
              <div key={result._id} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-2">{result.breachName}</h2>
                <p className="text-gray-600 mb-4">{result.breachDescription}</p>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                  {result.content}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-600">No results found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
