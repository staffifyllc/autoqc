interface PhotoFile {
  fileName: string;
  url: string;
  key: string;
}

export async function pushToAryeo(
  credentials: Record<string, string>,
  address: string,
  photos: PhotoFile[]
): Promise<{ listingId: string }> {
  const baseUrl = "https://api.aryeo.com/v1";
  const headers = {
    Authorization: `Bearer ${credentials.apiKey}`,
    "Content-Type": "application/json",
  };

  // Step 1: Create or find the listing
  const listingRes = await fetch(`${baseUrl}/listings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      address: address,
    }),
  });

  if (!listingRes.ok) {
    throw new Error(`Aryeo: Failed to create listing - ${listingRes.status}`);
  }

  const listing = await listingRes.json();
  const listingId = listing.data.id;

  // Step 2: Upload each photo to the listing
  for (const photo of photos) {
    // Download from S3 signed URL
    const imageRes = await fetch(photo.url);
    const imageBuffer = await imageRes.arrayBuffer();

    // Upload to Aryeo
    const formData = new FormData();
    formData.append("file", new Blob([imageBuffer]), photo.fileName);
    formData.append("listing_id", listingId);

    const uploadRes = await fetch(`${baseUrl}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.apiKey}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      console.error(
        `Aryeo: Failed to upload ${photo.fileName} - ${uploadRes.status}`
      );
    }
  }

  return { listingId };
}
