import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import { Like } from "../models/like.model.js";
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
  const { tweet } = req.body;

  if (!tweet) throw new apiError(400, "Tweet content required");

  const tweetRes = await Tweet.create({ content: tweet, owner: req.user?._id });

  if (!tweetRes) throw new apiError(500, "Error occured while creating tweet");

  let newTweet = {
    ...tweetRes._doc,
    owner: {
      fullName: req.user?.fullName,
      username: req.user?.username,
      avatar: req.user?.avatar,
    },
    totalDisLikes: 0,
    totalLikes: 0,
    isLiked: false,
    isDisLiked: false,
  };

  return res
    .status(200)
    .json(new apiResponse(200, newTweet, "tweet created successfully"));
});


const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets

  // TODO: get user tweets

  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new apiError(400, "Invalid user ID");
  }

  const tweets = await Tweet.find({ owner: userId }).sort({ createdAt: -1 });

  if (!tweets) {
    throw new apiError(404, "Tweets are not found");
  }

  return res
    .status(200)
    .json(new apiResponse(200, tweets, "User tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
     const { tweetId } = req.params;
  const { tweet } = req.body;
  if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweetId");
  if (!tweet) throw new apiError(400, "tweet content required");

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: tweet,
      },
    },
    {
      new: true,
    }
  );
  return res
    .status(200)
    .json(new apiResponse(200, updatedTweet, "tweet updated successfully"));
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
      const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) throw new apiError(400, "Invalid tweetId");

  const findRes = await Tweet.findByIdAndDelete(tweetId);

  if (!findRes) throw new apiError(500, "tweet not found");

  const deleteLikes = await Like.deleteMany({
    tweet: new mongoose.Types.ObjectId(tweetId),
  });

  return res
    .status(200)
    .json(new apiResponse(200, findRes, "tweet deleted successfully"));
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}