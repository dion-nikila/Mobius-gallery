const supported = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function encodeCanvas(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob?.type === "image/webp") resolve(blob);
      else reject(new Error("This browser cannot export WebP. Try an up-to-date Chrome, Firefox, or Safari."));
    }, "image/webp", quality);
  });
}

async function compress(source, dimension, maxBytes) {
  const canvas = document.createElement("canvas");
  let widthLimit = dimension;
  while (widthLimit >= 320) {
    const scale = Math.min(1, widthLimit / Math.max(source.width, source.height));
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [.87, .76, .64]) {
      const blob = await encodeCanvas(canvas, quality);
      if (blob.size <= maxBytes) return blob;
    }
    widthLimit = Math.floor(widthLimit * .8);
  }
  throw new Error("This image couldn’t be optimized. Export a smaller copy and try again.");
}

function asDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn’t read the optimized image."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImages(file) {
  if (!supported.includes(file.type)) throw new Error("Choose a JPG, PNG, WebP, or AVIF image.");
  if (file.size > 24 * 1024 * 1024) throw new Error("Choose an image smaller than 24 MB.");
  const source = await createImageBitmap(file).catch(() => {
    throw new Error("This file couldn’t be opened as an image.");
  });

  try {
    if (source.width * source.height > 50_000_000) throw new Error("Export an image below 50 megapixels and try again.");
    const image = await compress(source, 2400, 950_000);
    const thumbnail = await compress(source, 640, 110_000);
    const [fullData, preview] = await Promise.all([asDataUrl(image), asDataUrl(thumbnail)]);
    return {
      image: fullData.slice(fullData.indexOf(",") + 1),
      thumbnail: preview.slice(preview.indexOf(",") + 1),
      preview,
      bytes: image.size + thumbnail.size,
    };
  } finally {
    source.close();
  }
}
