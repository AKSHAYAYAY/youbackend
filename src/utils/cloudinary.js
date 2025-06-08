import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

   
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    console.log("✅ File uploaded:", response.url);

    // Delete local file after successful upload
    fs.unlink(localFilePath, (err) => {
      if (err) console.warn("⚠️ Failed to delete local file:", err.message);
    });

    return response;

  } catch (error) {
    // Only try deleting if file exists
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (err) {
        console.warn("⚠️ Failed to delete file in catch:", err.message);
      }
    }

    console.error("❌ Cloudinary upload failed:", error.message);
    return null;
  }
};

export { uploadOnCloudinary };
