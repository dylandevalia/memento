import QRCode from "qrcode";

/**
 * Generate a QR code as a base64 data URL (PNG).
 */
export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 400,
  });
}
