import qitsScraperService from "../services/qits.scraper.service.js";

export const scrapingQITSV2 = async (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({
      message:
        "Formato de datos inválido. Se espera un array en la propiedad 'data'.",
    });
  }

  try {
    const result = await qitsScraperService.runProcess(data);

    return res.status(200).json({
      message: "Scraping completado",
      total: data.length,
      counts: result.counts,
    });
  } catch (error) {
    console.error("Error crítico en el controlador QITS:", error);
    return res.status(500).json({
      message: "Error durante el scraping",
      error: error.message,
    });
  }
};
