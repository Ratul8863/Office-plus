import { getBackendClient } from "../api/backendClient.js";
import { formatStatus } from "../formatters/statusFormatter.js";

export const statusCommand = {
  name: "status",
  description: "Live office snapshot pulled from the backend",
  async execute(): Promise<string> {
    const api = getBackendClient();
    const [devices, usage, alerts] = await Promise.all([
      api.getState(),
      api.getUsage(),
      api.getActiveAlerts(),
    ]);
    return formatStatus({ devices, usage, alerts });
  },
};
