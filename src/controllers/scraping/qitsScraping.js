import { join } from "node:path";
import { appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  PASSWORD_PROD_QITS,
  PASSWORD_TEST_QITS,
  URL_PROD_QITS,
  URL_TEST_QITS,
  USER_PROD_QITS,
  USER_TEST_QITS,
  QITS_FILES_PATH
} from "../../config/config.js";

let pathFileError = join("src/logs/qits", `errorScraping.txt`);
let pathFileSuccessfully = join("src/logs/qits", `successfullyScraping.txt`);
let pathFileNotFoundStatus = join("src/logs/qits", `notFoundStatus.txt`);
let pathFileNotFoundFile = join("src/logs/qits", `notFoundFile.txt`);
let pathAlreadyFile = join("src/logs/qits", `alreadyFile.txt`);
let pathuserNotMatch = join("src/logs/qits", `userNotMatch.txt`);

puppeteer.use(StealthPlugin());

const createScrapingCounts = () => ({
  successfully: 0,
  error: 0,
  notFound: 0,
  notFoundStatus: 0,
  notFoundFile: 0,
  alreadyFile: 0,
  userNotMatch: 0,
});

export const loginQITS = async (url, username, password) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(url, { waitUntil: "networkidle2" });

    // Esperar a que los inputs existan antes de escribir
    await page.waitForSelector("input[name='username']");
    await page.type("input[name='username']", username, { delay: 50 });
    await page.type("input[name='password']", password, { delay: 50 });

    await page.waitForSelector("input[type='submit']", {
      visible: true,
      timeout: 5000,
    });

    await Promise.all([
      await page.click("input[type='submit']"),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }),
    ]);

    console.log("Login exitoso en QITS");

    return { browser, page };
  } catch (error) {
    console.error("Error en loginQITS:", error);
    if (browser) await browser.close();
    throw error;
  }
};

export const insertDataQITS = async (page, data) => {
  const counts = createScrapingCounts();

  try {
    await page.waitForSelector(".liContentOpcionesConsultas", {
      visible: true,
      timeout: 5000,
    });
    await page.hover(".liContentOpcionesConsultas");
    await page.click("#idMenuconsultaExpedientesDevueltos");

    for (let item of data) {
      try {
        //Validacion de la existencia del input para buscar
        await page.waitForSelector("#formOpGenerales\\:textNroExpediente", {
          timeout: 5000,
        });

        //Dar 3 clicks para eliminar e insertar el siguiente
        await page.click("#formOpGenerales\\:textNroExpediente", {
          clickCount: 3,
        });
        await page.keyboard.press("Backspace");
        //Digitar el nuevo expediente
        await page.type(
          "#formOpGenerales\\:textNroExpediente",
          item.NRO_EXPEDIENTE,
        );
        //Dar click en el boton Buscar
        await page.click("#formOpGenerales\\:buttonConsultar");

        const resultado = await page
          .waitForSelector(
            "#formOpGenerales\\:infoExpediente\\:0\\:idFindDetalleCartera",
            { timeout: 5000 },
          )
          .catch(() => null);

        if (resultado === null) {
          console.log(
            `No se encontró información para el expediente ${item.NRO_EXPEDIENTE}`,
          );
          counts.notFound++;
          appendFile(
            pathFileError,
            `No se encontró información para el expediente ${item.NRO_EXPEDIENTE
            } ${new Date().toLocaleString()}\n`,
            (err) => {
              if (err) throw err;
            },
          );

          await page.evaluate(() => {
            const button = document.querySelector(
              "#formDetalleCartera\\:idBtnVolverDetalleCartera",
            );
            if (button) button.click();
          });

          await page.waitForSelector("#formOpGenerales\\:textNroExpediente", {
            timeout: 5000,
          });

          continue;
        }

        // Dar clic sobre el td del expediente
        await page.evaluate(() => {
          const element = document.querySelector(
            "#formOpGenerales\\:infoExpediente\\:0\\:idFindDetalleCartera",
          );
          if (element) element.click();
        });

        await page.waitForNavigation(3000);//eliminar

        // Scroll
        await page.locator(".contenedor").scroll({
          scrollLeft: 10,
          scrollTop: 20,
        });

        // Selecciona el elemento basado en el rol y verifica el texto
        const roleSelector = 'td[role="gridcell"] span';
        const textToCheck = item.NRO_EXPEDIENTE;
        // Espera a que el elemento esté disponible
        await page.waitForSelector(roleSelector);
        // Obtiene el texto del elemento
        const texts = await page.$$eval(roleSelector, (elements) =>
          elements.map((el) => el.textContent.trim()),
        );

        // Buscamos el span que dice 'Identificación' y seleccionamos el hermano (span) siguiente
        /*const element = await page.waitForSelector(
          'xpath///span[contains(text(), "Identificación")]/following-sibling::span',
        );

        const identificacionEnWeb = await page.evaluate(
          (el) => el.textContent,
          element,
        );

        //Extraemos solo los dígitos del texto obtenido de la web
        const idWebLimpia = identificacionEnWeb.replace(/\D/g, "");
        const idDataLimpia = String(item.NUMERO_DOCUMENTO).replace(/\D/g, "");

        if (idWebLimpia !== idDataLimpia) {
          counts.userNotMatch++;
          appendFile(
            pathuserNotMatch,
            `${idWebLimpia} NO coincide con el identificador de la data (${idDataLimpia}). Expediente ${textToCheck} ${item.NRO_EXPEDIENTE
            } ${new Date().toLocaleString()}\n`,
            (err) => {
              if (err) throw err;
            },
          );
        }*/
        // Verifica si el texto "Profile" está presente en alguno de los elementos
        const isTextVisible = texts.includes(textToCheck);

        if (isTextVisible) {
          counts.alreadyFile++;
          appendFile(
            pathAlreadyFile,
            `Expediente ${textToCheck} ya ingresado ${item.NRO_EXPEDIENTE
            } ${new Date().toLocaleString()}\n`,
            (err) => {
              if (err) throw err;
            },
          );

          await page.evaluate(() => {
            const button = document.querySelector(
              "#formDetalleCartera\\:idBtnVolverDetalleCartera",
            );
            if (button) button.click();
          });

          await page.waitForNavigation(4000); //eliminar
          continue;
        } else {
          //Validacion de que si el input file existe
          const elementHandle = await page
            .waitForSelector("input[type=file]", { timeout: 3000 })
            .catch(() => null);

          if (elementHandle != null) {
            const pathFile = join(
              QITS_FILES_PATH,
              `${item.NRO_EXPEDIENTE}.pdf`,
            );

            let validationFile = existsSync(pathFile);

            if (validationFile) {
              await elementHandle.uploadFile(pathFile);

              //Esperar a que el boton  SUBIR se muestre
              await page.waitForSelector(
                ".ui-fileupload-upload:not([disabled])",
                {
                  visible: true,
                  timeout: 5000,
                },
              );
              await page.click(".ui-fileupload-upload:not([disabled])");

              appendFile(
                pathFileSuccessfully,
                `Expediente ${item.NRO_EXPEDIENTE
                } cargado correctamente - ${new Date().toLocaleString()}\n`,
                function (err) {
                  if (err) throw err;
                },
              );
              counts.successfully++;

              await setTimeout(2000);

              //Dar click en boton VOLVER
              await page.evaluate(() => {
                const button = document.querySelector(
                  "#formDetalleCartera\\:idBtnVolverDetalleCartera",
                );
                if (button) button.click();
              });
            } else {
              counts.notFoundFile++;
              appendFile(
                pathFileNotFoundFile,
                `No se encontró el archivo para el expediente ${item.NRO_EXPEDIENTE
                } ${new Date().toLocaleString()}\n`,
                function (err) {
                  if (err) throw err;
                },
              );
              // Ir atrás y continuar
              await page.evaluate(() => {
                const button = document.querySelector(
                  "#formDetalleCartera\\:idBtnVolverDetalleCartera",
                );
                if (button) button.click();
              });
              page.waitForSelector("#formOpGenerales\\:textNroExpediente", {
                timeout: 5000,
              });

              await page.waitForNavigation(4000); //eliminar
              continue;
            }
          } else {
            counts.notFoundStatus++;
            appendFile(
              pathFileNotFoundStatus,
              `No se encontró el input para el expediente ${item.NRO_EXPEDIENTE
              } ${new Date().toLocaleString()}\n`,
              function (err) {
                if (err) throw err;
              },
            );
            // Ir atrás y continuar
            await page.evaluate(() => {
              const button = document.querySelector(
                "#formDetalleCartera\\:idBtnVolverDetalleCartera",
              );
              if (button) button.click();
            });
            await page.waitForSelector("#formOpGenerales\\:textNroExpediente", {
              timeout: 5000,
            });
            continue;
          }
        }
      } catch (err) {
        console.log(err);
        counts.error++;
        appendFile(
          pathFileError,
          `Error al cargar expediente ${item.NRO_EXPEDIENTE} ${err.message
          } ${new Date().toLocaleString()}\n`,
          function (err) {
            if (err) throw err;
          },
        );
        continue;
      }
    }

    return counts;
  } catch (error) {
    console.error("Error en insertData QITS:", error);
    throw error;
  }
};

export const scrapingQITS = async (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({
      message:
        "Formato de datos inválido. Se espera un array en la propiedad 'data'.",
    });
  }
  let browser;
  try {
    //const session = await loginQITS(
    //  URL_TEST_QITS,
    //  USER_TEST_QITS,
    //  PASSWORD_TEST_QITS,
    //);

    const session = await loginQITS(
      URL_PROD_QITS,
      USER_PROD_QITS,
      PASSWORD_PROD_QITS,
    );
    browser = session.browser;
    const counts = await insertDataQITS(session.page, data);

    return res.status(200).json({
      message: "Scraping completado",
      total: data.length,
      counts,
    });
  } catch (error) {
    console.error("Error crítico:", error);
    return res.status(500).json({
      message: "Error durante el scraping",
      error: error.message,
    });
  } finally {
    if (browser) await browser.close();
  }
};
