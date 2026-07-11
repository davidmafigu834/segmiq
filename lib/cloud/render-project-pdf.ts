import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Page } from "puppeteer-core";

const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

const PRINT_IMAGE_MAX_WIDTH = 1400;
const PRINT_IMAGE_JPEG_QUALITY = 0.82;

function localChromePath(): string | null {
  if (process.env.CHROMIUM_LOCAL_EXECUTABLE) {
    return process.env.CHROMIUM_LOCAL_EXECUTABLE;
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome";
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.NODE_ENV === "development") {
    const local = localChromePath();
    if (local) return local;
  }

  const packUrl = process.env.CHROMIUM_REMOTE_EXEC_PATH ?? DEFAULT_CHROMIUM_PACK_URL;
  return chromium.executablePath(packUrl);
}

async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
      )
    )
  );
}

async function compressPrintImages(page: Page): Promise<void> {
  await page.evaluate(
    async (maxWidth, quality) => {
      async function recompress(img: HTMLImageElement) {
        if (!img.naturalWidth || img.naturalWidth <= maxWidth) return;
        try {
          const scale = maxWidth / img.naturalWidth;
          const canvas = document.createElement("canvas");
          canvas.width = maxWidth;
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          img.src = canvas.toDataURL("image/jpeg", quality);
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        } catch {
          // Keep original source if canvas is tainted or compression fails.
        }
      }

      await Promise.all(Array.from(document.images).map(recompress));
    },
    PRINT_IMAGE_MAX_WIDTH,
    PRINT_IMAGE_JPEG_QUALITY
  );
}

export async function renderProjectPdf(printUrl: string): Promise<Buffer> {
  chromium.setGraphicsMode = false;

  const executablePath = await resolveExecutablePath();
  const isServerless = process.env.NODE_ENV !== "development";

  const browser = await puppeteer.launch({
    args: isServerless ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 794, height: 1123 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "load", timeout: 45_000 });
    await waitForImages(page);
    await compressPrintImages(page);
    await page.emulateMediaType("screen");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
