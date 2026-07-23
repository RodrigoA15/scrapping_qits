import multer from "multer";
import fs from "node:fs/promises";
import { join } from "node:path";
import qitsScraperService from "../services/qits.scraper.service.js";
import readFileService from "../services/readFile.service.js";

export const scrapingQITSV2 = async (req, res) => {
  try {
    const path = multer({ dest: "src/data/" });
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, "src/data/");
      },

      filename: (req, file, cb) => {
        cb(null, file.originalname);
      },
    });

    const upload = multer({
      storage: storage,
      dest: path,
      fileFilter: (req, file, cb) => {
        const filetypes = /xlsx|xls|sheet/;
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype) {
          return cb(null, true);
        }
        cb(new Error("Archivo no válido, solo se permiten archivos Excel"));
      },
    });

    upload.single("GUIAS_COBRO")(req, res, async (err) => {
      if (err) {
        return res.status(400).json(err.message);
      }

      if (!req.file) {
        return res.status(400).json("No se ha enviado ningún archivo");
      }

      console.log("Archivo creado correctamente");

      const data = await readFileService.readXlsx();

      const result = await qitsScraperService.runProcess(data);
      const PATH_FILE = await fs.readdir("src/data");
      const path = join("src/data", PATH_FILE[0]);
      await fs.unlink(path);

      return res.status(200).json({
        message: "Scraping completado",
        total: data.length,
        counts: result.counts,
      });
    });
  } catch (error) {
    console.error("Error crítico en el controlador QITS:", error);
    return res.status(500).json({
      message: "Error durante el scraping",
      error: error.message,
    });
  }
};
