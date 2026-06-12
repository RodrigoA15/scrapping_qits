import { Router } from "express";
import {
  scrapingQITS,
  scrapingQITSRemoveFiles,
} from "../controllers/scraping/qitsScraping.js";
import { scrapingQITSV2 } from "../controllers/qits.controller.js";

const router = Router();

router.post("/scraping-qits", scrapingQITS);
//NUEVA VERSION
router.post("/v2/scraping-qits", scrapingQITSV2);
router.post("/scraping-qits-remove-files", scrapingQITSRemoveFiles);

export default router;
