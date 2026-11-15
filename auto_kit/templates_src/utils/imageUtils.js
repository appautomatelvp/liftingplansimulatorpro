// [LOCKED] - NÉN ẢNH HIỆN TRƯỜNG QUA CANVAS TRƯỚC KHI LƯU / XUẤT PDF (V4.5)
export function compressImageForPDF(base64Str, maxWidth = 1024, quality = 0.6) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (err) => reject(err);
      img.src = base64Str;
    } catch (error) {
      console.error("❌ [IMAGE UTILS - compressImageForPDF]: Lỗi nén ảnh:", error);
      reject(error);
    }
  });
}

export function removeVietnameseAccents(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
