import { Router } from "express";
import { powerCalculatorService } from "../services/powerCalculator.service";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: powerCalculatorService.getUsage(),
  });
});

export default router;
