import { Router } from "express";
import { insertDataQITS, loginQITS, scrapingQITS } from "../controllers/scraping/qitsScraping.js";

const router = Router();

router.post("/scraping-qits", scrapingQITS);


export default router;