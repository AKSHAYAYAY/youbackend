import {asyncHandler} from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"

const registerUser = asyncHandler(async (req , res ) =>

{  const {fullName , email , username , password } = req.body

   if(
    [fullName , email , username , password].some((field)=> field ?.trim()==="") ) {
        throw new apiError(400 , "u have not filled field correctly")
    } // we r chcking if something is empty or not (some)neww wayy 
   


    // checking if user exist 

    const existedUser = await User.findOne({
        $or:[{username} , {email}] 
    })

    if(existedUser) {
        throw new apiError (409 , " u are already exist kindly use another one or log in ")
    }
     

    // avatar image mandatory getting path from multerr 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)


    if (!avatar) {
        throw new apiError(400, "Avatar file is required")
    }

    // database m entryyyyy // 
    const user = await User.create ({
        fullName ,
        avatar : avatar.url ,
        coverImage : coverImage?.url || "",
        email ,
        password ,
        username : username.toLowerCase()
    }) 
      const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    ) //  selct methode negate jo nhi chaiye 

    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }

    
    
    // api response 


 return res.status(201).json(
        new ApiResponse(200, createdUser, "hurrayy we are gettiing respond and user registered succesfully ")
    )

})

export {registerUser}









 // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res