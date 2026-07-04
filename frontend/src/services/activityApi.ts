import { apiRequest } from "./apiClient";
import type { ActivityEvent } from "@/types";

export const activityApi = {
  getRecent: (limit = 40) => apiRequest<ActivityEvent[]>(`/api/activity?limit=${limit}`),
};
