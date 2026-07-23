import xlsx from "xlsx";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

class ReadFileService {
  constructor() {}

  async readXlsx() {
    try {
      const PATH_FILE = await readdir("src/data");
      const path = join("src/data", PATH_FILE[0]);
      const workbook = xlsx.readFile(path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,
      });
      return jsonData;
    } catch (error) {
      console.error(
        `[ExcelParserService] Fallo en la extracción: ${error.message}`,
      );
      throw error;
    }
  }
}

export default new ReadFileService();
