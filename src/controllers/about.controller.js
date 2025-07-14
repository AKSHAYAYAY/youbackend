import mongoose, { isValidObjectId } from "mongoose";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const getAboutChannel = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Check if it's a valid ObjectId or username
  let matchCondition;
  if (isValidObjectId(userId)) {
    matchCondition = { _id: new mongoose.Types.ObjectId(userId) };
  } else {
    // Treat it as username
    matchCondition = { username: userId };
  }

  const aboutChannel = await User.aggregate([
    {
      $match: matchCondition,
    },
    // fetch total videos and views
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
        pipeline: [
          {
            $match: {
              isPublished: true,
            },
          },
          {
            $group: {
              _id: "$owner", // Fixed: added $ prefix
              totalVideos: { $count: {} },
              totalViews: { $sum: "$views" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "_id",
        foreignField: "owner",
        as: "tweets",
        pipeline: [
          {
            $group: {
              _id: "$owner", // Fixed: added $ prefix
              totalTweets: { $count: {} },
            },
          },
        ],
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        email: 1,
        totalVideos: {
          $cond: {
            if: { $gt: [{ $size: "$videos" }, 0] },
            then: { $first: "$videos.totalVideos" },
            else: 0,
          },
        },
        totalViews: {
          $cond: {
            if: { $gt: [{ $size: "$videos" }, 0] },
            then: { $first: "$videos.totalViews" },
            else: 0,
          },
        },
        totalTweets: {
          $cond: {
            if: { $gt: [{ $size: "$tweets" }, 0] },
            then: { $first: "$tweets.totalTweets" },
            else: 0,
          },
        },
        links: 1,
        createdAt: 1,
        description: 1,
      },
    },
  ]);

  // Fixed: check if user exists
  if (!aboutChannel || aboutChannel.length === 0) {
    throw new apiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(
      new apiResponse(200, aboutChannel[0], "channel details sent successfully")
    );
});

export const addChannelDescription = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const description = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        description: content || "",
      },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .json(new apiResponse(200, description, "Description added successfully"));
});

export const addLink = asyncHandler(async (req, res) => {
  const { name, url } = req.body;

  if (!name || !url) throw new apiError(400, "all fields required");

  const links = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $push: {
        links: {
          name,
          url,
        },
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new apiResponse(200, links, "links added successfully"));
});

export const removeLink = asyncHandler(async (req, res) => {
  const { linkId } = req.params;

  if (!isValidObjectId(linkId)) throw new apiError(400, "Invalid linkId");

  const link = await User.findByIdAndUpdate(
    req.user?._id, // Fixed: removed object wrapper
    { $pull: { links: { _id: linkId } } },
    { new: true } // Added new: true to get updated document
  );

  if (!link) throw new apiError(404, "User not found");

  return res
    .status(200)
    .json(new apiResponse(200, [], "links removed successfully"));
});

export const updateLink = asyncHandler(async (req, res) => {
  const { name, url } = req.body;
  const { linkId } = req.params;

  if ((!name && !url) || !isValidObjectId(linkId))
    throw new apiError(400, "one field required");

  // Fixed: create update object dynamically to avoid setting undefined values
  const updateFields = {};
  if (name) updateFields["links.$[elem].name"] = name;
  if (url) updateFields["links.$[elem].url"] = url;

  const result = await User.updateOne(
    { _id: req.user?._id },
    { $set: updateFields },
    { arrayFilters: [{ "elem._id": linkId }] }
  );

  if (result.modifiedCount === 0) throw new apiError(404, "link not found");

  return res
    .status(200)
    .json(new apiResponse(200, result, "links updated successfully"));
});