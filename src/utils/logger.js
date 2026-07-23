import { appendFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_LOG_PATH = "src/logs/qits";

export const logEvent = async (type, message) => {
  const fileNames = {
    error: "errorScraping.txt",
    successfully: "successfullyScraping.txt",
    notFoundStatus: "notFoundStatus.txt",
    notFoundFile: "notFoundFile.txt",
    alreadyFile: "alreadyFile.txt",
    userNotMatch: "userNotMatch.txt",
    notFound: "notFoundExpediente.txt"
  };

  const fileName = fileNames[type];
  if (!fileName) return;

  const path = join(BASE_LOG_PATH, fileName);
  const logLine = `${message} - ${new Date().toLocaleString()}\n`;

  try {
    await appendFile(path, logLine);
  } catch (err) {
    console.error(`Error escribiendo log [${type}]:`, err);
  }
};
