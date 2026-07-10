import { Router, type IRouter } from "express";
import healthRouter from "./health";
import busesRouter from "./buses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(busesRouter);

export default router;
