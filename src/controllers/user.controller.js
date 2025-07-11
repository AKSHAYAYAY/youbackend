/*import {asyncHandler} from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import {
  deleteImageOnCloudinary,
  uploadPhotoOnCloudinary as uploadOnCloudinary,
} from "../utils/cloudinary.js";
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
    // clear cookies from browser
    const options = {
        httpOnly: true,// this will not allow js to access cookies
        secure: true // this will allow cookies to be sent only over https
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

    const user = await User.findById(req.user?._id)// we are getting user from verifyJWT middleware 
    const isPasswordCorrectCheck = await  user.isPasswordCorrect(oldPassword) 

    if(!isPasswordCorrectCheck) {
        throw new apiError(
            400 ,  " u have forgot your password "
        )
    }

    user.password = newPassword 
    await user.save({validateBeforeSave : false })// we are not validating password again as we have already done it in registeration

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

const clearWatchHistory = asyncHandler(async (req, res) => {
  const isCleared = await User.findByIdAndUpdate(
    new mongoose.Types.ObjectId(req.user?._id),
    {
      $set: {
        watchHistory: [],
      },
    },
    {
      new: true,
    }
  );
  if (!isCleared) throw new apiError(500, "Failed to clear history");
  return res
    .status(200)
    .json(new apiResponse(200, [], "History Cleared Successfully"));
});







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
 clearWatchHistory ,




}/*









// for regstration :
 // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res  */

    import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import {
  deleteImageOnCloudinary,
  uploadPhotoOnCloudinary as uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// TODO: Review and Enhance all controllers

// Add this constant for consistent cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  maxAge: 24 * 60 * 60 * 1000, // 1 day
  path: '/'
};

const generateAccessAndRefreshToken = async (_id) => {
  try {
    const user = await User.findById(_id);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { refreshToken, accessToken };
  } catch (error) {
    throw new apiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Get the data from frontend
  // Validate the data - Check if empty or not
  // check if user exists or not
  // Handle file uploads
  // upload files in cloudinary
  // create user
  // check if user created successfully
  // send back the response

  // Getting the data from frontend
  let { username, password, fullName, email } = req.body;

  // Validating and formating the data
  if (
    [username, password, fullName, email].some((field) => field?.trim() === "")
  ) {
    throw new apiError(400, `all fields are required!!!`);
  }

  // checking if user exists or not
  const userExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExist) {
    // throw new apiError(400, "User Already Exists...");
    return res
      .status(400)
      .json(new apiResponse(400, [], "User Already Exists..."));
  }

  // Handling File

  let avatarLocalPath = "";
  if (req.files && req.files.avatar && req.files?.avatar.length > 0) {
    avatarLocalPath = req.files?.avatar[0]?.path;
  }

  let coverImageLocalPath = "";
  if (req.files && req.files.coverImage && req.files?.coverImage.length > 0) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new apiError(400, "avatar Image is Required");
  }

  // uploading on cloudinary

  let avatarRes = await uploadOnCloudinary(avatarLocalPath);
  if (!avatarRes)
    throw new apiError(500, "Internal Server Error!!! Files Unable to Upload");

  let coverImageRes = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : "";

  // Create new user
  const createdUser = await User.create({
    username: username.toLowerCase(),
    password,
    email,
    fullName,
    coverImage: coverImageRes?.url || "",
    avatar: avatarRes.url,
  });

  // checking if user is created successfully

  const userData = await User.findById(createdUser._id).select(
    "-password -refreshToken"
  );

  if (!userData) {
    throw new apiError(500, "Something went wrong while registering the user");
  }

  // Send back data to frontend
  return res
    .status(201)
    .json(new apiResponse(200, userData, "Account Created Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // data <- req.body
  // validate data
  // find User
  // generate tokens
  // store tokens in database
  // set tokens in cookie
  // send response

  // data <- req.body

  let { email, password, username } = req.body;
  // console.log(email, password, username)

  // validate
  if ((!email && !username) || !password) {
    throw new apiError(400, "Username or Email is required");
  }

  // find User
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    // throw new apiError(404, "User not Found");
    return res.status(404).json(new apiResponse(404, [], "User not Found"));
  }

  const isCredentialValid = await user.isPasswordCorrect(password);
  if (!isCredentialValid) {
    // throw new apiError(401, "Credential Invalid");
    return res
      .status(401)
      .json(new apiResponse(401, [], "Invalid Credentials"));
  }

  // generate and store tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -watchHistory"
  );

  // set tokens in cookie and send response
  // const cookieOptions = {
  //   httpOnly: true,
  //   secure: true,
  //   sameSite: "None",
  //   Partitioned: true,
  // };

   // Clear any existing tokens first
   res.clearCookie('accessToken', COOKIE_OPTIONS);
   res.clearCookie('refreshToken', COOKIE_OPTIONS);
 
   // Set new tokens
   res.cookie('accessToken', accessToken, COOKIE_OPTIONS);
   res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 10 * 24 * 60 * 60 * 1000 }); // 10 days for refresh token
 
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  // Clear cookies
  res.clearCookie('accessToken', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  return res
    .status(200)
    .json(new apiResponse(200, {}, "Logged out Successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new apiError(401, "unauthorized request");
  }

  try {
    const decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedRefreshToken?._id);

    if (!user) {
      throw new apiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new apiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    res.cookie('accessToken', accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 10 * 24 * 60 * 60 * 1000 });

    return res
      .status(200)
      .json(
        new apiResponse(
          200,
          { accessToken, refreshToken },
          "Access Token Refreshed Successfully"
        )
      );
  } catch (error) {
    throw new apiError(401, error?.message || "Invalid refresh token");
  }
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Caution
  if (!oldPassword || !newPassword) {
    throw new apiError(400, "All Fields Required");
  }

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new apiError(401, "Old Password is not Correct");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new apiResponse(201, req.user, "User fetched Successfully"));
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, email, username, description } = req.body;

  if (!fullName && !email && !username && !description) {
    throw new apiError(400, "At least one field required");
  }

  const user = await User.findById(req.user?._id);

  if (fullName) user.fullName = fullName;

  if (email) user.email = email;

  if (description) user.description = description;

  if (username) {
    const isExists = await User.find({ username });
    if (isExists?.length > 0) {
      throw new apiError(400, "Username not available");
    } else {
      user.username = username;
    }
  }

  const updatedUserData = await user.save();

  if (!updatedUserData) {
    new apiError(500, "Error while Updating User Data");
  }

  delete updatedUserData.password;

  return res
    .status(200)
    .json(
      new apiResponse(200, updatedUserData, "Profile updated Successfully")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new apiError(400, "File required");
  }

  const avatarImg = await uploadOnCloudinary(avatarLocalPath);

  if (!avatarImg) {
    throw new apiError(500, "Error Accured While uploading File");
  }

  await deleteImageOnCloudinary(req.user?.avatar);

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: avatarImg.url },
    },
    {
      new: true,
    }
  ).select("-password");

  if (!updatedUser) {
    new apiError(500, "Error while Updating database");
  }

  return res
    .status(200)
    .json(new apiResponse(200, updatedUser, "avatar updated Successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new apiError(400, "File required");
  }

  const coverImg = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImg) {
    throw new apiError(500, "Error Accured While uploading File");
  }

  await deleteImageOnCloudinary(req.user?.coverImage);

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: coverImg.url },
    },
    {
      new: true,
    }
  ).select("-password");

  if (!user) {
    new apiError(500, "Error accured while Updating database");
  }

  return res
    .status(200)
    .json(new apiResponse(200, user, "Cover Image updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username) {
    throw new apiError(400, "no username found");
  }

  const channelUser = await User.aggregate([
    {
      $match: {
        // this gives channel document
        username: username?.toLowerCase(),
      },
    },
    {
      // this gives Subscribers of channel
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      // this gives subcriptions of channel
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);

  if (!channelUser?.length) {
    throw new apiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(new apiResponse(200, channelUser[0], "Channel Fetched Successfully"));
});

// TODO Get Proper WatchHistory
const getNewWatchHistory = asyncHandler(async (req, res) => {
  const userWatchHistory = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $project: { watchHistory: 1 },
    },
    {
      $unwind: {
        path: "$watchHistory",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $sort: {
        "watchHistory.createdAt": -1,
      },
    },
    {
      $addFields: {
        "watchHistory.watchedDate": {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$watchHistory.createdAt",
          },
        },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory.video",
        foreignField: "_id",
        as: "watchHistory.video",
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
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        "watchHistory.video": {
          $first: "$watchHistory.video",
        },
      },
    },
    {
      $group: {
        _id: "$watchHistory.watchedDate",
        videos: {
          $push: "$watchHistory",
        },
      },
    },
  ]);

  let watchHistory = userWatchHistory;

  return res
    .status(200)
    .json(new apiResponse(200, watchHistory, "History Fetched Successfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const userWatchHistory = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
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
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
    {
      $project: {
        watchHistory: 1,
      },
    },
  ]);

  let watchHistory = userWatchHistory[0].watchHistory;

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        watchHistory.reverse(),
        "History Fetched Successfully"
      )
    );
});

const clearWatchHistory = asyncHandler(async (req, res) => {
  const isCleared = await User.findByIdAndUpdate(
    new mongoose.Types.ObjectId(req.user?._id),
    {
      $set: {
        watchHistory: [],
      },
    },
    {
      new: true,
    }
  );
  if (!isCleared) throw new apiError(500, "Failed to clear history");
  return res
    .status(200)
    .json(new apiResponse(200, [], "History Cleared Successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  updateUserProfile,
  getCurrentUser,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  clearWatchHistory,
};