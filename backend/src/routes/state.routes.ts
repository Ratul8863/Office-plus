import { Router } from "express";
import { officeStateService } from "../services/officeState.service";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: officeStateService.getDevices(),
  });
});

export default router;
