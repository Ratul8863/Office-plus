import { Router } from "express";
import { persistenceService } from "../services/persistence.service";

const router = Router();

router.get("/", async (req, res) => {
  const parsedLimit = Number.parseInt(String(req.query.limit ?? "40"), 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 40;

  const activity = await persistenceService.getRecentActivity(limit);

  res.json({
    success: true,
    data: activity,
  });
});

export default router;
