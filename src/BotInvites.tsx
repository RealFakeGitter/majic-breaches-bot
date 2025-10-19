import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function BotInvites() {
  const discordInvite = useQuery(api.bots.generateDiscordInvite);
  const revoltInvite = useQuery(api.bots.generateRevoltInvite);

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 mb-12">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Add Bot to Your Server</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Discord Bot */}
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Discord Bot</h3>
          <p className="text-gray-600 mb-4">
            Add the Majic Breaches bot to your Discord server for easy breach searches.
          </p>
          {discordInvite ? (
            <a
              href={discordInvite}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 text-white py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors inline-block"
            >
              Add to Discord
            </a>
          ) : (
            <div className="text-gray-500">Bot not configured</div>
          )}
        </div>

        {/* Revolt Bot */}
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">R</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Revolt Bot</h3>
          <p className="text-gray-600 mb-4">
            Add the Majic Breaches bot to your Revolt server for breach searches.
          </p>
          {revoltInvite ? (
            <a
              href={revoltInvite}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-red-600 text-white py-2 px-6 rounded-lg hover:bg-red-700 transition-colors inline-block"
            >
              Add to Revolt
            </a>
          ) : (
            <div className="text-gray-500">Bot not configured</div>
          )}
        </div>
      </div>
    </div>
  );
}
