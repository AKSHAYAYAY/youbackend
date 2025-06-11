import {asyncHandler} from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js" 


import jwt from "jsonwebtoken"



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
    .json(new apiResponse(200, {}, "User logged Out"))
}) 
 const  refreshAccessToken =  asyncHandler(async(req ,res)=>{
// refresh token ko access krne k liye cookies to verify ki say user hi hai 
 //const incomingRefreshToken = req.cookies.refreshAccessToken || req.body 
 const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken; // req.body for mobile user 
 if(!incomingRefreshToken){
    throw new apiError(401 ,"unauthroized request")
 }
  try {
    const decodedToken = jwt.verify( incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET)  
   const user = await User.findById (decodedToken?._id) 
   if(!user){
      throw new apiError( 401, "invalid refresh token  , please login")
   } 
   if(incomingRefreshToken !== user?.refreshToken){
      throw new apiError(401 , "expired refreshtoken")
   } 
   const options = {
      httpOnly : true ,
       secure : true  }
   
    const{newAccessToken, newRefreshToken} =  await generateAccessAndRefreshTokens(user._id)  
      return res 
      .status(200) 
      .cookie("accessToken", newAccessToken , options)
      .cookie("refreshtoken" , newRefreshToken , options) 
      .json(
          new apiResponse(
              200 , 
              {newAccessToken , newRefreshToken} ,
              "accesstoken is regenrated/refreshed successfully"
          )
      )
  } catch (error) {
    throw  new apiError (401 , error?.message || "invalid refreshToken")
    
  }

 }) 

 const changeCurrentPassword = asyncHandler(async (req , res) =>
{
    const {oldPassword , newPassword} = req.body 
    // user s aayega 

    const user = await User.findById(req.user?._id) 
    const isPasswordCorrectCheck = await  user.isPasswordCorrect(oldPassword) 

    if(!isPasswordCorrectCheck) {
        throw new apiError(
            400 ,  " u have forgot your password "
        )
    }

    user.password = newPassword 
    await user.save({validateBeforeSave : false })

    return res 
    .status (400 )
    .json
        (new apiResponse(200 , {} , "password changes successfully")
 )


})
const currentUser = asyncHandler(async(req , res)=>{
     return res 
     .status (200)
     .json(new apiResponse (200 , req.user , "cuuretnuser is fetched")) 
})
 const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new apiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, user, "Account details updated successfully"))
});

const updateAvatar = asyncHandler(async(req ,res)=>{
    const {avatarLocalPath} = req.file?.path 
    if (!avatarLocalPath){
        throw new apiError(
            401 , "no avatar found , please add new one"
        )
    }
    const avatar =  await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new apiError(400 , "error uploading avator error on cloudnary")
    }
     const user = await User.findByIdAndUpdate (req.user?._id,{
      $set:{
        avatar : avatar.url 
      }  

     },
    {new : true} 
    ).select (-password)

     return res
    .status(200)
    .json(new apiResponse(200, user, "avatar updated successfully"))
})

const updatecoverImage= asyncHandler(async(req ,res)=>{
    const {coverImageLocalPath} = req.file?.path 
    if (!coverImageLocalPathath){
        throw new apiError(
            401 , "no avatar found , please add new one"
        )
    }
    const coverImage =  await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new apiError(400 , "error uploading avator error on cloudnary")
    }
     const user = await User.findByIdAndUpdate (req.user?._id,{
      $set:{
        coverImage : coverImage.url 
      }  

     },
    {new : true} 
    ).select (-password)

     return res
    .status(200)
    .json(new apiResponse(200, user, "CoverImage updated successfully")) 



})

// we are doing user profile section // 

const getUserChannelProfile = asyncHandler(async(req , res)=>{
    const {username} = req.params 

    if(!username?.trim()) {
        throw new apiError(400 , "username is not there ")
    }
        // we can have like before of getting user and then accesing the id but match retuen a single doc so better //
    const channel = await User.aggregate ([
        { // pipe line 1 
            $match: {
                username : username?.toLowerCase()
            }

        } ,
        {
            // pipeline 2  lookup to edit or join 4 parameter  
            $lookup: 
            {
                from : "subscriptions" ,
                localField : "_id" ,
                foreignField: "channel",
                as: "subscribers" // channel as search jitne doc aaye utne uss channel k subcriber 
            } 
        } ,

           { 
            // pipeline 3 
               $lookup: {
                from : "subscriptions" ,
                localField : "_id" ,
                foreignField: "subscriber",
                as: " subscriberTo" // a partiicular id  kitno ko subcribe kiye h 
                      }  
              },
        

        // adding field  +  checking if it is subscriber or not follow button to show 
        {
             $addFields: {
                subscribersCount: {
                     $size: { $ifNull: ["$subscribers", []] } 
                },
                channelsSubscribedToCount: {
                    $size: { $ifNull: ["$subscriberTo", []] } },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true, // frontend 
                        else: false  // frontend 
                    }
                }
            }
        } ,

        {
            // wht to project 
            $project : {
                 fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }

    ])

    if (!channel?.length) {
        throw new apiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "User channel infoo fetched successfully")
    )
})

// to get watch history we need to go to video schema then in it we have owner of video 
// whose data is is user then we need nested and we are sending only history at final as [0] index 
const getWatchHistory = asyncHandler(async (req , res )=> {
    const user = await User.aggregate([
        {
            $match :{
                _id : new mongoose.Types.ObjectId(req.user._id) 
            }


        },
        {
            
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )

        
    
})








export {registerUser,
         loginUser,
          logoutUser,
          refreshAccessToken ,
          currentUser , 
          updateAccountDetails, 
          updateAvatar ,  
          updatecoverImage , 
      getUserChannelProfile ,
           getWatchHistory ,
 changeCurrentPassword ,




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