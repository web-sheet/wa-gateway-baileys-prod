import axios from "axios";

export function convertGoogleDriveUrl(url) {
  const match = url.match(/\/d\/([^/]+)/);

  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }

  return url;
}

export async function downloadFile(url) {
  const finalUrl = convertGoogleDriveUrl(url);

  const response = await axios.get(finalUrl, {
    responseType: "arraybuffer",
    maxRedirects: 5,
  });

  return {
    buffer: Buffer.from(response.data),
    contentType: response.headers["content-type"],
    fileSize: response.headers["content-length"],
  };
}