import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

export function BotInvites() {
  const discordInvite = useQuery(api.bots.generateDiscordInvite);
  const revoltInvite = useQuery(api.bots.generateRevoltInvite);

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${platform} invite link copied to clipboard!`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
      {/* Discord Invite */}
      <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-indigo-100 hover:border-indigo-200 transition-colors">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Add to Discord</h2>
          <p className="text-gray-600">
            Invite our bot to your Discord server and start searching breaches with slash commands
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Permissions Required:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Send Messages</li>
              <li>• Use Slash Commands</li>
              <li>• Embed Links</li>
            </ul>
          </div>

          {discordInvite ? (
            <div className="space-y-3">
              <a
                href={discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center"
              >
                <span className="mr-2">🔗</span>
                Invite to Discord
              </a>
              <button
                onClick={() => copyToClipboard(discordInvite, "Discord")}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Copy Invite Link
              </button>
            </div>
          ) : discordInvite === null ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Discord bot not configured</p>
              <p className="text-sm text-gray-400 mt-1">Set DISCORD_CLIENT_ID environment variable</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading invite link...</p>
            </div>
          )}
        </div>
      </div>

      {/* Revolt Invite */}
      <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-red-100 hover:border-red-200 transition-colors">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">R</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Add to Revolt</h2>
          <p className="text-gray-600">
            Invite our bot to your Revolt server and start searching breaches with text commands
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Permissions Required:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Send Messages</li>
              <li>• Read Message History</li>
              <li>• Embed Links</li>
            </ul>
          </div>

          {revoltInvite ? (
            <div className="space-y-3">
              <a
                href={revoltInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <span className="mr-2">🔗</span>
                Invite to Revolt
              </a>
              <button
                onClick={() => copyToClipboard(revoltInvite, "Revolt")}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Copy Invite Link
              </button>
            </div>
          ) : revoltInvite === null ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Revolt bot not configured</p>
              <p className="text-sm text-gray-400 mt-1">Set REVOLT_BOT_ID environment variable</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading invite link...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
