import {asyncHandler} from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js" 




const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken() ;
        const refreshToken =  user.generateRefreshToken();
        // initially refresh token me 0 tha islye refresh token ko update kiya ur db me kuch change tph validate krna hoga elsepassword id required
            user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    }
    catch(error){
        throw new apiError(500 , "Something went wrong") ;

    }
}

const registerUser = asyncHandler(async (req , res ) =>

{  const {fullName  , username , password } = req.body
   console.log(req.body) ;

   if(
    [fullName  , username , password].some((field)=> field ?.trim()==="") ) {
        throw new apiError(400 , "u have not filled field correctly")
    } // we r chcking if something is empty or not (some)neww wayy  


   // check password 
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(password)) {
    throw new apiError(400, "Password must be at least 8 characters long and include an uppercase letter, a number, and a special character.");
}
 

            // check emailllll 

        const { email } = req.body;

const cleanedEmail = email?.trim();

if (!cleanedEmail || cleanedEmail.includes(" ") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
  return res.status(400).json({ message: "Please enter a valid email address." });
}



    // checking if user exist  $ for multiplr check 

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

     let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
       coverImageLocalPath = req.files.coverImage[0].path
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
        username:  username.toLowerCase()
    }) 


      const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    ) //  selct methode negate jo nhi chaiye 

    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }

    
    
    // api response 


 return res.status(201).json(
        new apiResponse(200, createdUser, "hurrayy we are gettiing respond and user registered succesfully ")
    )

})

const loginUser = asyncHandler(async(req ,res)=>{
    const {username , email , password} = req.body 
    if(!(username ||email)){
       throw  new apiError(400 , "cant find ussername or email") 
    }
    
    const user = await User.findOne({
        $or:[{username} , {email}] 
    }) 
    if(!user){
        throw new apiError( 404 , "no user found ");
        
    }
      const checkPassword = await user.isPasswordCorrect( password ) 
      if(!checkPassword){
        throw new apiError(401 , "wrong passwrod , enter correct password ") ;
      }

      const {accessToken, refreshToken} =  await generateAccessAndRefreshTokens(user._id)

const loggedInUser =  await User.findById(user._id).select("-password  -refreshToken") 
const options = {
    httpOnly :true,
    secure : true   // isse server use kr payega frontend nhi kr payega
}

return res 
.status(200)
.cookie("accessToken",accessToken,options)
.cookie("refreshToken",refreshToken,options)
.json(new apiResponse(
    200, 
    {user : loggedInUser , accessToken , refreshToken},
    "lognIn successfully"
))


    
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})


export {registerUser,
     loginUser, logoutUser
}








// for regstration :
 // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res