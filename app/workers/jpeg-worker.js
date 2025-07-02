let canvas = null;
let ctx = null;

self.onmessage = async (event) => {
  const { bitmap, width, height, quality = 1 } = event.data;
  try {
    if (!canvas) {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
    }
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    // Convert Blob to base64 using FileReader to avoid large argument spread issues (stack overflow)
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is a data URL: "data:image/jpeg;base64,<base64>"
      const result = reader.result;
      const base64 = result.split(',')[1];
      self.postMessage({ base64 });
    };
    reader.onerror = (e) => {
      self.postMessage({ error: e?.message || 'FileReader error' });
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    self.postMessage({ error: err.message || String(err) });
  }
};
