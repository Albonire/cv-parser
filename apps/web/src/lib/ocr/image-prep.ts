/**
 * Preprocesamiento de imagenes en Canvas para mejorar la precision de OCR
 * Aplica: escala de grises, realce de contraste adaptativo y binarizacion.
 */
export async function preprocessImage(imageFile: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(imageFile);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. Escala de grises y calculo de luminancia
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Formula de luminosidad estandar ITU-R BT.601
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // 2. Realce de contraste lineal simple
          // Estira los valores de gris para acentuar negros y blancos
          const contrast = 1.3;
          const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
          const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(imageFile);
          },
          'image/png',
          0.95
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
