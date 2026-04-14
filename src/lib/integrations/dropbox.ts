import { Dropbox } from "dropbox";

interface PhotoFile {
  fileName: string;
  url: string;
  key: string;
}

export async function pushToDropbox(
  credentials: Record<string, string>,
  platform: string, // "spiro" or "tonomo"
  address: string,
  photos: PhotoFile[]
): Promise<{ folderPath: string; uploadedCount: number }> {
  const dbx = new Dropbox({ accessToken: credentials.accessToken });

  // Sanitize address for folder name
  const folderName = address.replace(/[^a-zA-Z0-9\s-]/g, "").trim();

  // Each platform expects a different folder structure
  let basePath: string;
  if (platform === "spiro") {
    // Spiro watches for folders structured as: /Client Name/Property Address/
    basePath = credentials.rootFolder
      ? `${credentials.rootFolder}/${folderName}`
      : `/${folderName}`;
  } else {
    // Tonomo expects: /Service Type/Property Address/
    basePath = credentials.rootFolder
      ? `${credentials.rootFolder}/${folderName}`
      : `/Home Photos/${folderName}`;
  }

  // Create the folder
  try {
    await dbx.filesCreateFolderV2({ path: basePath });
  } catch (err: any) {
    // Folder may already exist
    if (err?.error?.error_summary?.includes("path/conflict")) {
      // OK, folder exists
    } else {
      throw err;
    }
  }

  // Upload each photo
  let uploadedCount = 0;
  for (const photo of photos) {
    try {
      const imageRes = await fetch(photo.url);
      const imageBuffer = await imageRes.arrayBuffer();

      await dbx.filesUpload({
        path: `${basePath}/${photo.fileName}`,
        contents: imageBuffer,
        mode: { ".tag": "overwrite" },
      });

      uploadedCount++;
    } catch (err) {
      console.error(`Dropbox: Failed to upload ${photo.fileName}:`, err);
    }
  }

  return { folderPath: basePath, uploadedCount };
}
