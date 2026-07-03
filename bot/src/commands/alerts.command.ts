import { getBackendClient } from "../api/backendClient";
import { formatAlerts } from "../formatters/alertFormatter";

export const alertsCommand = {
  name: "alerts",
  description: "List active alerts (or an all-clear message when none)",
  async execute(): Promise<string> {
    const api = getBackendClient();
    const alerts = await api.getActiveAlerts();
    return formatAlerts(alerts);
  },
};
