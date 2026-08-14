/**
 * Descarga una imagen desde una URL y la convierte a Blob para almacenamiento offline.
 */
export async function downloadImageAsBlob(url: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo descargar la imagen");
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Error al persistir imagen offline:", error);
    return undefined;
  }
}

const MAX_PRODUCT_IMAGE_SIDE = 1200;
const MAX_UNCHANGED_IMAGE_BYTES = 700_000;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Reduce fotos tomadas con el celular antes de enviarlas. Esto evita subir varios
 * megabytes y mantiene una resolucion mas que suficiente para las tarjetas del POS.
 */
export async function optimizeProductImage(file: File) {
  if (file.size <= MAX_UNCHANGED_IMAGE_BYTES) {
    return blobToDataUrl(file);
  }

  let source: CanvasImageSource;
  let sourceWidth: number;
  let sourceHeight: number;
  let releaseSource = () => {};

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;
    releaseSource = () => bitmap.close();
  } else {
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo abrir la imagen seleccionada."));
      element.src = objectUrl;
    }).catch((error) => {
      URL.revokeObjectURL(objectUrl);
      throw error;
    });
    source = image;
    sourceWidth = image.naturalWidth;
    sourceHeight = image.naturalHeight;
    releaseSource = () => URL.revokeObjectURL(objectUrl);
  }

  try {
    const scale = Math.min(1, MAX_PRODUCT_IMAGE_SIDE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("El navegador no pudo procesar la imagen.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo optimizar la imagen."))),
        "image/jpeg",
        0.82,
      );
    });

    return blobToDataUrl(optimizedBlob);
  } finally {
    releaseSource();
  }
}
