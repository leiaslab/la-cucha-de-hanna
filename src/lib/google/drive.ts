import "server-only";

import { Readable } from "node:stream";
import { google } from "googleapis";
import { getServerEnv } from "../server-env";

const PEPSHOP_FOLDER_NAME = "PepShop POS";

function getDriveClient() {
  const serverEnv = getServerEnv();
  const auth = new google.auth.JWT({
    email: serverEnv.googleDriveClientEmail,
    key: serverEnv.googleDrivePrivateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

async function ensurePepShopFolder() {
  const serverEnv = getServerEnv();
  const drive = getDriveClient();
  const parentFilter = serverEnv.googleDriveParentFolderId
    ? ` and '${serverEnv.googleDriveParentFolderId}' in parents`
    : "";
  const query =
    `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${PEPSHOP_FOLDER_NAME}'` +
    parentFilter;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const folderId = existing.data.files?.[0]?.id;
  if (folderId) {
    return folderId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: PEPSHOP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: serverEnv.googleDriveParentFolderId ? [serverEnv.googleDriveParentFolderId] : undefined,
    },
    fields: "id",
    supportsAllDrives: true,
  });

  if (!created.data.id) {
    throw new Error("No se pudo crear la carpeta PepShop POS en Google Drive.");
  }

  return created.data.id;
}

export async function uploadPdfToDrive({
  fileName,
  buffer,
}: {
  fileName: string;
  buffer: Uint8Array;
}) {
  const drive = getDriveClient();
  const folderId = await ensurePepShopFolder();

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/pdf",
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink,webContentLink",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) {
    throw new Error("Google Drive no devolvio un fileId para el PDF.");
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
    supportsAllDrives: true,
  });

  return {
    driveFileId: fileId,
    driveUrl: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}
