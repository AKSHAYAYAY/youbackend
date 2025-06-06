import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"


   
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
   
    

   const uploadOnCloudinary = async (localfilepath) => {
    try{
        if(!localfilepath) return null 
        // upload 
        const response = await cloudinary.uploader.uploader.upload
        (localfilepath , { resource_type: "auto" })
        // upload done 
        console.log( " uploadeddd fileee " , response.url) ;
        return response ;
    }

    catch(error) {
        fs.unlinkSync(localfilepath) // remove local saved file when upload is failled
        return null ;
    }

   
}


export  {uploadOnCloudinary} ;