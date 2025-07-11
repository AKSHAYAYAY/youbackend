/*import { v2 as cloudinary } from 'cloudinary';
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
*/
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadPhotoOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    console.log("uploading thumbnail...");

    //Uploading File to Cloudinary
    const cldnry_res = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "videotube/photos",
    });

    // File Uploaded Successfully & Removing File From Local System
    fs.unlinkSync(localFilePath);
    return cldnry_res;
  } catch (error) {
    fs.unlinkSync(localFilePath); //Removing File From Local System
    console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error);
    return null;
  }
};

// const uploadVideoOnCloudinary = async (localFilePath) => {

  const uploadVideoOnCloudinary = async (localFilePath) => {
    try {
      if (!localFilePath) return null;
  
      console.log("uploading video...");
  
      // Uploading File to Cloudinary with HLS format
      const cldnry_res = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "video",
        folder: "videotube/videos",
        eager: [
          {
            streaming_profile: "hd", // Streaming profile, can be 'full_hd' or 'sd' etc.
            format: "m3u8", // Format for HLS
          },
        ],
      });
  
      console.log("clodnairy videofile ka", cldnry_res)
      // File Uploaded Successfully & Removing File From Local System
      fs.unlinkSync(localFilePath);
  
      // Checking if eager transformation returned the HLS URL
      const hlsurl = cldnry_res.eager?.[0]?.secure_url;
  
      return { ...cldnry_res, hlsurl };
    } catch (error) {
      fs.unlinkSync(localFilePath); //Removing File From Local System
      console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error);
      return null;
    }
  };
  
//   try {
//     if (!localFilePath) return null;

//     console.log("uploading video...");

//     //Uploading File to Cloudinary
//     const cldnry_res = await cloudinary.uploader.upload(localFilePath, {
//       resource_type: "video",
//       folder: "videotube/videos",
//     });

//     // File Uploaded Successfully & Removing File From Local System
//     fs.unlinkSync(localFilePath);

//     return cldnry_res;
//   } catch (error) {
//     fs.unlinkSync(localFilePath); //Removing File From Local System
//     console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error);
//     return null;
//   }
// };

const deleteImageOnCloudinary = async (URL) => {
  try {
    if (!URL) return false;

    let ImageId = URL.match(
      /(?:image|video)\/upload\/v\d+\/videotube\/(photos|videos)\/(.+?)\.\w+$/
    )[2];

    console.log("deleting image from cloudinary...");

    const cldnry_res = await cloudinary.uploader.destroy(
      `videotube/photos/${ImageId}`,
      {
        resource_type: "image",
      }
    );

    return cldnry_res;
  } catch (error) {
    console.log("CLOUDINARY :: FILE Delete ERROR ", error);
    return false;
  }
};

const deleteVideoOnCloudinary = async (URL) => {
  try {
    if (!URL) return false;

    let VideoId = URL.match(
      /(?:image|video)\/upload\/v\d+\/videotube\/(photos|videos)\/(.+?)\.\w+$/
    )[2];

    console.log("deleting video from cloudinary...");

    const cldnry_res = await cloudinary.uploader.destroy(
      `videotube/videos/${VideoId}`,
      {
        resource_type: "video",
      }
    );

    return cldnry_res;
  } catch (error) {
    console.log("CLOUDINARY :: FILE Delete ERROR ", error);
    return false;
  }
};

export {
  uploadPhotoOnCloudinary,
  uploadVideoOnCloudinary,
  deleteImageOnCloudinary,
  deleteVideoOnCloudinary,
};