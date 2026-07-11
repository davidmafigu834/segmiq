import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Page } from "puppeteer-core";
import { optimizeImageToDataUrl, printImageMaxWidth } from "@/lib/cloud/optimize-print-image";

const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

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
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map(async (img) => {
        if (img.complete && img.naturalWidth > 0) {
          if (typeof img.decode === "function") {
            try {
              await img.decode();
            } catch {
              // Ignore decode errors; the image may still paint in PDF output.
            }
          }
          return;
        }

        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });

        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch {
            // Ignore decode errors; the image may still paint in PDF output.
          }
        }
      })
    );
  });
}

async function injectOptimizedImages(page: Page): Promise<void> {
  const images = await page.evaluate(() =>
    Array.from(document.images).map((img, index) => ({
      index,
      src: img.currentSrc || img.src,
      className: img.className,
    }))
  );

  for (const image of images) {
    const optimized = await optimizeImageToDataUrl(
      image.src,
      printImageMaxWidth(image.className)
    );
    if (!optimized) continue;

    await page.evaluate(
      (index, dataUrl) => {
        const img = document.images[index];
        if (!img) return;
        img.removeAttribute("crossorigin");
        img.src = dataUrl;
      },
      image.index,
      optimized
    );
  }

  await waitForImages(page);
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
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 60_000 });
    await waitForImages(page);
    await injectOptimizedImages(page);
    await page.evaluate(() => {
      document.documentElement.style.setProperty("background", "#ffffff", "important");
      document.body.style.setProperty("background", "#ffffff", "important");
      document.body.style.setProperty("color", "#1c1410", "important");
    });
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
