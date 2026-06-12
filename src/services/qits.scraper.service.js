import { join } from "node:path";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logEvent } from "../utils/logger.js";
import {
  URL_PROD_QITS,
  USER_PROD_QITS,
  PASSWORD_PROD_QITS,
  QITS_FILES_PATH,
} from "../config/config.js";

puppeteer.use(StealthPlugin());

class QitsScraperService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async runProcess(data) {
    try {
      await this.initBrowser();
      await this.login(URL_PROD_QITS, USER_PROD_QITS, PASSWORD_PROD_QITS);

      const counts = await this.insertData(data);
      return { counts };
    } catch (error) {
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  async insertData(data) {
    const counts = {
      successfully: 0,
      error: 0,
      notFound: 0,
      notFoundStatus: 0,
      notFoundFile: 0,
      alreadyFile: 0,
      userNotMatch: 0,
    };

    await this.page.waitForSelector(".liContentOpcionesConsultas", {
      visible: true,
    });
    await this.page.hover(".liContentOpcionesConsultas");
    await this.page.click("#idMenuconsultaExpedientesDevueltos");

    for (const item of data) {
      try {
        await this.processSingleRecord(item, counts);
      } catch (err) {
        console.error(
          `Error procesando expediente ${item.NRO_EXPEDIENTE}:`,
          err,
        );
        counts.error++;
        await logEvent(
          "error",
          `Error al cargar expediente ${item.NRO_EXPEDIENTE} - ${err.message}`,
        );

        await this.goBackToSearch();
      }
    }

    return counts;
  }

  async processSingleRecord(item, counts) {
    const inputSelector = "#formOpGenerales\\:textNroExpediente";
    const btnConsultar = "#formOpGenerales\\:buttonConsultar";
    const resultRow =
      "#formOpGenerales\\:infoExpediente\\:0\\:idFindDetalleCartera";

    await this.page.waitForSelector(inputSelector, {
      visible: true,
      timeout: 10000,
    });

    // 1. Limpiar input y buscar
    await this.page.click(inputSelector, { clickCount: 3 });
    await this.page.keyboard.press("Backspace");
    await this.page.type(inputSelector, item.NRO_EXPEDIENTE);
    await this.page.click(btnConsultar);

    // 2. Esperar resultado.
    const resultElement = await this.page
      .waitForSelector(resultRow, { timeout: 8000 })
      .catch(() => null);

    if (!resultElement) {
      console.log(
        `No se encontró info para el expediente ${item.NRO_EXPEDIENTE}`,
      );
      counts.notFound++;
      await logEvent(
        "notFound",
        `No se encontró información para el expediente ${item.NRO_EXPEDIENTE}`,
      );
      await this.goBackToSearch();
      return;
    }

    // 3. Clic en el resultado
    await this.page.$eval(resultRow, (linkElement) => linkElement.click());

    // 4. Esperar a que cargue la vista de detalle
    await this.page.waitForSelector(".contenedor", {
      visible: true,
      timeout: 10000,
    });

    // Validar existencia de documento
    const exists = await this.checkIfDocumentExists(item.NRO_DOCUMENTO);
    if (exists) {
      counts.alreadyFile++;
      await logEvent(
        "alreadyFile",
        `Expediente ${item.NRO_DOCUMENTO} ya ingresado (${item.NRO_EXPEDIENTE})`,
      );
      await this.goBackToSearch();
      return;
    }

    // 5. Carga de archivo
    const fileInput = await this.page
      .waitForSelector("input[type=file]", { timeout: 5000 })
      .catch(() => null);

    if (!fileInput) {
      counts.notFoundStatus++;
      await logEvent(
        "notFoundStatus",
        `No se encontró el input para el expediente ${item.NRO_EXPEDIENTE}`,
      );
      await this.goBackToSearch();
      return;
    }

    const pathFile = join(QITS_FILES_PATH, `${item.NRO_DOCUMENTO}.PNG`);
    if (!existsSync(pathFile)) {
      counts.notFoundFile++;
      await logEvent(
        "notFoundFile",
        `No se encontró el archivo físico para el expediente ${item.NRO_EXPEDIENTE}`,
      );
      await this.goBackToSearch();
      return;
    }
    // Subir y confirmar
    await fileInput.uploadFile(pathFile);
    await this.page.waitForSelector(".ui-fileupload-upload:not([disabled])", {
      visible: true,
      timeout: 10000,
    });
    await this.page.click(".ui-fileupload-upload:not([disabled])");

    await this.waitForPrimeFacesLoader();

    counts.successfully++;
    await logEvent(
      "successfully",
      `Expediente ${item.NRO_EXPEDIENTE} cargado correctamente`,
    );
    await this.goBackToSearch();
  }

  async checkIfDocumentExists(documentNumber) {
    const selectorFilas =
      'tbody[id="formDetalleCartera:idTableDocMandamiento_data"] tr';
    await this.page
      .waitForSelector(selectorFilas, { timeout: 10000 })
      .catch(() => null);

    return await this.page.$$eval(
      selectorFilas,
      (filas, textoBuscado) => {
        return filas.some((fila) => {
          const celda = fila.querySelector("td:nth-child(5)");
          return celda && celda.textContent.trim() === textoBuscado;
        });
      },
      documentNumber,
    );
  }

  async goBackToSearch() {
    const btnVolver = "#formDetalleCartera\\:idBtnVolverDetalleCartera";
    const inputBusqueda = "#formOpGenerales\\:textNroExpediente";

    // Intentamos darle click al botón de volver si existe en el DOM actual
    await this.page.evaluate((btnSelector) => {
      const button = document.querySelector(btnSelector);
      if (button) button.click();
    }, btnVolver);

    // Esperamos a que el input de búsqueda de la pantalla anterior vuelva a estar visible
    await this.page
      .waitForSelector(inputBusqueda, { visible: true, timeout: 10000 })
      .catch(() => null);
  }

  async waitForPrimeFacesLoader() {
    try {
      await this.page
        .waitForNavigation({ waitUntil: "networkidle0", timeout: 3000 })
        .catch(() => null);
      // Si tienes identificada la clase del loader (ej. .ui-widget-overlay), la mejor práctica es:
      // await this.page.waitForSelector('.ui-widget-overlay', { hidden: true, timeout: 10000 });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async initBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setDefaultNavigationTimeout(60000);
  }

  async login(url, username, password) {
    console.log("Navegando a QITS...");
    await this.page.goto(url, { waitUntil: "networkidle2" });

    await this.page.waitForSelector("input[name='username']");
    await this.page.type("input[name='username']", username, { delay: 50 });
    await this.page.type("input[name='password']", password, { delay: 50 });

    await this.page.waitForSelector("input[type='submit']", { visible: true });

    await Promise.all([
      this.page.click("input[type='submit']"),
      this.page.waitForNavigation({ waitUntil: "networkidle0" }),
    ]);

    console.log("Login exitoso. Esperando renderizado del dashboard...");

    await this.page.waitForSelector(".liContentOpcionesConsultas", {
      visible: true,
      timeout: 15000,
    });
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default new QitsScraperService();
