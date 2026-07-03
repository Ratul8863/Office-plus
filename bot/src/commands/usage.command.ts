import { getBackendClient } from "../api/backendClient";
import { formatUsage } from "../formatters/usageFormatter";

export const usageCommand = {
  name: "usage",
  description: "Office-wide watt, kWh, and per-room breakdown",
  async execute(): Promise<string> {
    const api = getBackendClient();
    const usage = await api.getUsage();
    return formatUsage(usage);
  },
};
