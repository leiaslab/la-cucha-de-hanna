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