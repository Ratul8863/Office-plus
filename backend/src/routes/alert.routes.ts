import { Router } from "express";
import { alertService } from "../services/alert.service";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: alertService.getAlerts(),
  });
});

router.get("/active", (_req, res) => {
  res.json({
    success: true,
    data: alertService.getActiveAlerts(),
  });
});

export default router;
