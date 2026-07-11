import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

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
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 45_000 });
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
