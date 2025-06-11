import { Router } from "express"; 
import { registerUser ,
     loginUser ,
      logoutUser,
       refreshAccessToken,
        currentUser,
         updateAccountDetails,
          updatecoverImage,
           updateAvatar,
            getUserChannelProfile,
             getWatchHistory  , 
             changeCurrentPassword ,
            } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const router = Router()

router.route("/register").post(
    upload.fields([        // middleware multer 
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
    )
router.route("/login").post(loginUser) 
router.route("/logout").post(verifyJWT,  logoutUser)
router.route("/refreshtoken").post(refreshAccessToken) 
router.route("/currentUser").get( verifyJWT , currentUser)
router.route("/updateDetails").post(verifyJWT , updateAccountDetails)
router.route("/update-avatar").patch(verifyJWT , upload.single("avatar") , updateAvatar  )
router.route("/cover-image").patch(verifyJWT , upload.single("coverImage") , updatecoverImage)
router.route("/c/:username").get(verifyJWT , getUserChannelProfile)  // taking from params //
router.route("/history").get(verifyJWT , getWatchHistory)
router.route("/changePassword").post(verifyJWT, changeCurrentPassword)

export default router


