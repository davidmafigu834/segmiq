import chromium from "@sparticuz/chromium-min";
import puppeteer, { type Page } from "puppeteer-core";
import { optimizeImageToDataUrl, printImageMaxWidth } from "@/lib/cloud/optimize-print-image";

const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

const PAGE_LOAD_TIMEOUT_MS = 45_000;
const IMAGE_WAIT_TIMEOUT_MS = 20_000;
const IMAGE_OPTIMIZE_BUDGET_MS = 28_000;
const IMAGE_OPTIMIZE_CONCURRENCY = 4;

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function injectOptimizedImages(page: Page): Promise<void> {
  const images = await page.evaluate(() =>
    Array.from(document.images).map((img, index) => ({
      index,
      src: img.currentSrc || img.src,
      className: img.className,
    }))
  );

  const startedAt = Date.now();
  const optimized = await mapWithConcurrency(images, IMAGE_OPTIMIZE_CONCURRENCY, async (image) => {
    if (Date.now() - startedAt > IMAGE_OPTIMIZE_BUDGET_MS) {
      return { index: image.index, dataUrl: null as string | null };
    }
    const dataUrl = await optimizeImageToDataUrl(
      image.src,
      printImageMaxWidth(image.className)
    );
    return { index: image.index, dataUrl };
  });

  for (const image of optimized) {
    if (!image.dataUrl) continue;
    await page.evaluate(
      (index, dataUrl) => {
        const img = document.images[index];
        if (!img) return;
        img.removeAttribute("crossorigin");
        img.src = dataUrl;
      },
      image.index,
      image.dataUrl
    );
  }

  await waitForImages(page);
}

export async function renderProjectPdf(printUrl: string): Promise<Buffer> {
  chromium.setGraphicsMode = false;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const executablePath = await resolveExecutablePath();
    const isServerless = process.env.NODE_ENV !== "development";

    browser = await puppeteer.launch({
      args: isServerless ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(PAGE_LOAD_TIMEOUT_MS);
    page.setDefaultTimeout(PAGE_LOAD_TIMEOUT_MS);

    const response = await withTimeout(
      page.goto(printUrl, { waitUntil: "load", timeout: PAGE_LOAD_TIMEOUT_MS }),
      PAGE_LOAD_TIMEOUT_MS,
      "Print page load"
    );

    if (!response || !response.ok()) {
      throw new Error(
        `Print page returned ${response?.status() ?? "no response"} for ${printUrl}`
      );
    }

    await withTimeout(waitForImages(page), IMAGE_WAIT_TIMEOUT_MS, "Image load");
    await withTimeout(injectOptimizedImages(page), IMAGE_OPTIMIZE_BUDGET_MS + 5_000, "Image optimization");

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
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown PDF render error";
    throw new Error(`PDF render failed: ${detail}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
