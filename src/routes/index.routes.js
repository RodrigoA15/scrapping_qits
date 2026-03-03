import { Router } from "express";
import routesQits from "./qitsRoutes.routes.js";

const router = Router();

const pathRoutes = "/api/v1";

router.use(`${pathRoutes}/qits`, routesQits);

export default router;
