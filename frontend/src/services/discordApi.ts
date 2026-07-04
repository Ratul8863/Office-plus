import { apiRequest } from "./apiClient";
import type { DiscordIntegrationOverview } from "@/types";

export const discordApi = {
  getOverview: () =>
    apiRequest<DiscordIntegrationOverview>("/api/integrations/discord"),
};
