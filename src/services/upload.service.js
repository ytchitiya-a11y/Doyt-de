const cloudinary = require('../config/cloudinary');

/**
 * Uploads an image buffer (from multer memoryStorage) to Cloudinary
 * and returns the hosted image URL to save in products.image_url.
 */
const uploadImageToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'instant-delivery/products', // keeps product images organized in one folder
        resource_type: 'image',
        transformation: [{ width: 800, height: 800, crop: 'limit' }], // auto-resize, saves bandwidth
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result); // result.secure_url is what we need
      }
    );
    stream.end(fileBuffer);
  });
};

module.exports = { uploadImageToCloudinary };
