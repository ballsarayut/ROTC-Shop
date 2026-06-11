export async function verifySlipImage(base64Image: string, mimeType: string, expectedAmount: number, expectedAccountName?: string) {
  try {
    const response = await fetch('/api/verify-slip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        mimeType,
        expectedAmount,
        expectedAccountName,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to verify slip');
    }

    return await response.json() as {
      isValidSlip: boolean;
      extractedAmount: number | null;
      amountMatches: boolean;
      message: string;
    };
  } catch (error) {
    console.error("verifySlipImage error:", error);
    return null;
  }
}
