import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken" 
import {User} from "../models/user.model.js" ;


export const verifyJWT =  asyncHandler(async ( req ,  res , next ) =>{
  try {
     const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    // if cookie m access token h toh usse lelo otherwise jo syntax hota baki sab hta do 


     if(!token){
        throw new apiError( 401 , "Unauthorized request ")
     }

     const decodedToken  = jwt.verify(token , process.env.ACCESS_TOKEN_SECRET) ;
     // IF TOKEN H TOH JWT HI VERIFY KREGAA 

     console.log(decodedToken)

      const user = await User.findById(decodedToken?._id).select("-password -refreshToken") 


      if(!user) {

        throw new apiError ( 401 , "invalid access token")
      }

        req.user = user;
        next()



  } catch (error) {
    throw new apiError(401 , error?.message || "invalid access token")
  }
})