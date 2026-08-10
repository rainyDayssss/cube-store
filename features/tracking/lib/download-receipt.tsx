"use client";

import { pdf } from "@react-pdf/renderer";
import { ReceiptDocument, type ReceiptData } from "@/features/tracking/components/receipt-pdf";

/**
 * Generates a PDF receipt and triggers a browser download.
 * Client-only — uses @react-pdf/renderer's pdf() to create a blob,
 * then creates a temporary download link.
 */
export async function downloadReceipt(data: ReceiptData): Promise<void> {
  try {
    const blob = await pdf(<ReceiptDocument data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cube-store-receipt-${data.orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to generate receipt PDF:", err);
    throw new Error("Could not generate receipt. Please try again.");
  }
}
