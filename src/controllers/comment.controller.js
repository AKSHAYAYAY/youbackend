import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw apiError(400, "Invalid Video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw apiError(404, "Video not found");
  }

  const allComments = await Comment.aggregate([
    { $match: { video: new mongoose.Types.ObjectId(videoId) } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
        pipeline: [
          { $match: { liked: true } },
          { $group: { _id: null, owners: { $push: "$likedBy" } } },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "dislikes",
        pipeline: [
          { $match: { liked: false } },
          { $group: { _id: null, owners: { $push: "$likedBy" } } },
        ],
      },
    },
    {
      $addFields: {
        likes: {
          $cond: [
            { $gt: [{ $size: "$likes" }, 0] },
            { $first: "$likes.owners" },
            [],
          ],
        },
        dislikes: {
          $cond: [
            { $gt: [{ $size: "$dislikes" }, 0] },
            { $first: "$dislikes.owners" },
            [],
          ],
        },
      },
    },
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
              avatar: 1,
              _id: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$owner" },
    {
      $project: {
        content: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        isOwner: {
          $eq: [req.user?._id, "$owner._id"],
        },
        likesCount: { $size: "$likes" },
        disLikesCount: { $size: "$dislikes" },
        isLiked: { $in: [req.user?._id, "$likes"] },
        isDisLiked: { $in: [req.user?._id, "$dislikes"] },
        isLikedByVideoOwner: { $in: [video.owner, "$likes"] },
      },
    },
  ]);

  return res.status(200).json(
    apiResponse(200, allComments, "Comments fetched successfully")
  );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(videoId)) {
    throw apiError(400, "Invalid Video ID");
  }

  if (!content || content.trim() === "") {
    throw apiError(400, "Comment content cannot be empty");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });

  if (!comment) {
    throw apiError(500, "Failed to add comment");
  }

  const { username, avatar, fullName, _id } = req.user;

  const responseData = {
    ...comment._doc,
    owner: { username, avatar, fullName, _id },
    likesCount: 0,
    isOwner: true,
  };

  return res.status(201).json(
    apiResponse(201, responseData, "Comment added successfully")
  );
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw apiError(400, "Invalid Comment ID");
  }

  if (!content || content.trim() === "") {
    throw apiError(400, "Updated content cannot be empty");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { content } },
    { new: true }
  );

  if (!updatedComment) {
    throw apiError(404, "Comment not found or failed to update");
  }

  return res.status(200).json(
    apiResponse(200, updatedComment, "Comment updated successfully")
  );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw apiError(400, "Invalid Comment ID");
  }

  const deletedComment = await Comment.findByIdAndDelete(commentId);

  if (!deletedComment) {
    throw apiError(404, "Comment not found or already deleted");
  }

  await Like.deleteMany({ comment: new mongoose.Types.ObjectId(commentId) });

  return res.status(200).json(
    apiResponse(200, { isDeleted: true }, "Comment deleted successfully")
  );
});

export { getVideoComments, addComment, updateComment, deleteComment };
