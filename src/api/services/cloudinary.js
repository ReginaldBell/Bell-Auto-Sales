const cloudinary = require("cloudinary").v2;

// Validate required Cloudinary environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn("[Cloudinary] WARNING: Missing environment variables. Image uploads will fail.");
  console.warn("[Cloudinary] Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

function uploadBufferToCloudinary(buffer, { folder, publicId } = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: folder || process.env.CLOUDINARY_FOLDER || "bs-auto-sales",
      resource_type: "image",
      public_id: publicId || undefined,
    };

    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBufferToCloudinary };
