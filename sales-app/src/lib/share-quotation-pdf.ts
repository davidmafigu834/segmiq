import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type WhatsAppSharePlugin = {
  sharePdf(options: {
    base64: string;
    fileName?: string;
    phone?: string;
    message?: string;
  }): Promise<void>;
};

const WhatsAppShare = registerPlugin<WhatsAppSharePlugin>("WhatsAppShare");

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function shareViaNativeWhatsApp(
  pdfBlob: Blob,
  fileName: string,
  phone: string | null,
  message: string
): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    const base64 = await blobToBase64(pdfBlob);
    const digits = phone?.replace(/\D/g, "") ?? "";
    await WhatsAppShare.sharePdf({
      base64,
      fileName,
      phone: digits || undefined,
      message,
    });
    return true;
  } catch {
    return false;
  }
}

async function shareViaCapacitorSheet(pdfBlob: Blob, fileName: string): Promise<boolean> {
  try {
    const base64 = await blobToBase64(pdfBlob);
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    // File only — WhatsApp often drops attachments when text is included.
    await Share.share({
      files: [written.uri],
      dialogTitle: "Send quotation via WhatsApp",
    });
    return true;
  } catch {
    return false;
  }
}

async function shareViaWebApi(
  pdfBlob: Blob,
  fileName: string,
  message: string
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  const file = new File([pdfBlob], fileName, { type: "application/pdf" });
  try {
    const withFiles: ShareData = { files: [file], text: message };
    if (navigator.canShare?.(withFiles)) {
      await navigator.share(withFiles);
      return true;
    }
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return true;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
  }
  return false;
}

/** Share quotation PDF as a file attachment (not a link). */
export async function shareQuotationPdf(opts: {
  pdfBlob: Blob;
  fileName: string;
  phone: string | null;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { pdfBlob, fileName, phone, message } = opts;

  if (await shareViaNativeWhatsApp(pdfBlob, fileName, phone, message)) {
    return { ok: true };
  }
  if (Capacitor.isNativePlatform()) {
    if (await shareViaCapacitorSheet(pdfBlob, fileName)) {
      return { ok: true };
    }
    return { ok: false, error: "Could not open WhatsApp with the PDF." };
  }
  if (await shareViaWebApi(pdfBlob, fileName, message)) {
    return { ok: true };
  }
  return { ok: false, error: "Sharing PDF is not supported on this device." };
}

export async function fetchQuotationPdfBlob(
  pdfUrl: string,
  authToken?: string | null
): Promise<Blob> {
  const res = await fetch(pdfUrl, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  if (!res.ok) throw new Error("Could not download quotation PDF");
  return res.blob();
}
