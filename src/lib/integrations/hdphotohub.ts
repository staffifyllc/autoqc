interface PhotoFile {
  fileName: string;
  url: string;
  key: string;
}

export async function pushToHDPhotoHub(
  credentials: Record<string, string>,
  address: string,
  photos: PhotoFile[]
): Promise<{ orderId: string }> {
  // HDPhotoHub API is gated - these endpoints are based on their v1 API structure.
  // Actual endpoint paths may need adjustment once we get API access.
  const baseUrl = "https://hdphotohub.com/api/v1";
  const headers = {
    Authorization: `Bearer ${credentials.apiKey}`,
    "Content-Type": "application/json",
  };

  // Step 1: Create an order/media folder
  const orderRes = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      address: address,
      media_type: "photos",
    }),
  });

  if (!orderRes.ok) {
    throw new Error(
      `HDPhotoHub: Failed to create order - ${orderRes.status}`
    );
  }

  const order = await orderRes.json();
  const orderId = order.id;

  // Step 2: Upload photos to the order
  for (const photo of photos) {
    const imageRes = await fetch(photo.url);
    const imageBuffer = await imageRes.arrayBuffer();

    const formData = new FormData();
    formData.append("file", new Blob([imageBuffer]), photo.fileName);
    formData.append("order_id", orderId);

    const uploadRes = await fetch(`${baseUrl}/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.apiKey}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      console.error(
        `HDPhotoHub: Failed to upload ${photo.fileName} - ${uploadRes.status}`
      );
    }
  }

  return { orderId };
}
