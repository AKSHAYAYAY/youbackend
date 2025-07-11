import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteImageOnCloudinary,
  deleteVideoOnCloudinary,
  uploadPhotoOnCloudinary,
  uploadVideoOnCloudinary,
} from "../utils/cloudinary.js";
import { stopWords } from "../utils/helperData.js";


export const getAllVideosByOption = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy,
    sortType = "video",
    order,
    userId,
  } = req.query;

  // filter video by given filters
  let filters = { isPublished: true };
  if (isValidObjectId(userId))
    filters.owner = new mongoose.Types.ObjectId(userId);

  let pipeline = [
    {
      $match: {
        ...filters,
      },
    },
  ];

  const sort = {};

  // if query is given filter the videos
  if (search) {
    const queryWords = search
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .split(" ");
    const filteredWords = queryWords.filter(
      (word) => !stopWords.includes(word)
    );

    console.log("search: ", search);
    console.log("filteredWords: ", filteredWords);

    pipeline.push({
      $addFields: {
        titleMatchWordCount: {
          $size: {
            $filter: {
              input: filteredWords,
              as: "word",
              cond: {
                $in: ["$$word", { $split: [{ $toLower: "$title" }, " "] }],
              },
            },
          },
        },
      },
    });

    pipeline.push({
      $addFields: {
        descriptionMatchWordCount: {
          $size: {
            $filter: {
              input: filteredWords,
              as: "word",
              cond: {
                $in: [
                  "$$word",
                  { $split: [{ $toLower: "$description" }, " "] },
                ],
              },
            },
          },
        },
      },
    });

    sort.titleMatchWordCount = -1;
  }

  // sort the documents
  if (sortBy) {
    sort[sortBy] = parseInt(order);
  } else if (!search && !sortBy) {
    sort["createdAt"] = -1;
  }

  pipeline.push({
    $sort: {
      ...sort,
    },
  });

  // fetch owner detail
  pipeline.push(
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
      $unwind: "$owner",
    }
  );

  const videoAggregate = Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const allVideos = await Video.aggregatePaginate(videoAggregate, options);

  const { docs, ...pagingInfo } = allVideos;

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { videos: docs, pagingInfo },
        "All Query Videos Sent Successfully"
      )
    );
});


const getAllVideos = asyncHandler(async (req, res) => {
  // const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  //get all videos based on limit, query, sortBy, sortType, userId
  //match videos based on title and description
  //match videos based on user=owner
  //lookup owner field of video and get user details
  //add ownerField to the videos
  //set options for pagination
  //return the videos based on pipeline and options

  const { userId } = req.query;

  let filters = { isPublished: true };
  if (isValidObjectId(userId))
    filters.owner = new mongoose.Types.ObjectId(userId);

  let pipeline = [
    {
      $match: {
        ...filters,
      },
    },
  ];

  pipeline.push({
    $sort: {
      createdAt: -1,
    },
  });

  pipeline.push(
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
      $unwind: "$owner",
    }
  );

  const allVideos = await Video.aggregate(Array.from(pipeline));

  return res
    .status(200)
    .json(new ApiResponse(200, allVideos, "all videos sent"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  // TODO: get video, upload to cloudinary, create video
  //get video and thumbnail url from req.body
  //upload video and thumbnail to local storage and get path
  //get user id from req.user
  //upload video and thumbnail to cloudinary
  //create video document
  //return the video details

try {
  const { title, description } = req.body;
  if (!title) throw new ApiError(400, "Title is Required");

  const videoFileLocalFilePath = req.files?.videoFile?.[0]?.path;
  if (!videoFileLocalFilePath) throw new ApiError(400, "Video File Must be Required");

  const thumbnailLocalFilePath = req.files?.thumbnail?.[0]?.path;
  if (!thumbnailLocalFilePath) throw new ApiError(400, "Thumbnail File Must be Required");

  if (req.customConnectionClosed) return abortRequest();

  // Step 1: Upload video to Cloudinary
  const videoFile = await uploadVideoOnCloudinary(videoFileLocalFilePath);
  if (!videoFile || !videoFile.hlsurl) throw new ApiError(500, "Error while Uploading Video File");

  // Ensure video duration is available
  const videoDuration = videoFile.duration;
  if (!videoDuration) throw new ApiError(500, "Video duration is missing from Cloudinary response");

  // Step 2: Upload thumbnail
  const thumbnailFile = await uploadPhotoOnCloudinary(thumbnailLocalFilePath);
  if (!thumbnailFile) throw new ApiError(500, "Error while uploading thumbnail file");

  if (req.customConnectionClosed) return await cleanUpAndAbort(videoFile.url, thumbnailFile.url);

  // Step 3: Save the video to the database
  const video = await Video.create({
    videoFile: videoFile.hlsurl,
    title,
    description: description || "No description provided",
    duration: videoDuration,
    thumbnail: thumbnailFile.url,
    owner: req.user?._id,
  });

  if (!video) throw new ApiError(500, "Error while publishing video");

  if (req.customConnectionClosed) return await cleanUpAndAbort(videoFile.url, thumbnailFile.url, video._id);

  return res.status(200).json(new ApiResponse(200, video, "Video published successfully"));

} catch (error) {
  console.error("Error in publishAVideo controller:", error);
  
  // Clean up any uploaded files if an error occurs
  if (error.cloudinaryPublicId) {
    await cloudinary.uploader.destroy(error.cloudinaryPublicId);
  }
  
  return res.status(error.statusCode || 500).json(
    new ApiError(error.statusCode || 500, error.message || "An error occurred while publishing the video")
  );
}
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
        isPublished: true,
      },
    },
    // get all likes array
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
        pipeline: [
          {
            $match: {
              liked: true,
            },
          },
          {
            $group: {
              _id: "$liked",
              likeOwners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },
    // get all dislikes array
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "dislikes",
        pipeline: [
          {
            $match: {
              liked: false,
            },
          },
          {
            $group: {
              _id: "$liked",
              dislikeOwners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },
    // adjust shapes of likes and dislikes
    {
      $addFields: {
        likes: {
          $cond: {
            if: {
              $gt: [{ $size: "$likes" }, 0],
            },
            then: { $first: "$likes.likeOwners" },
            else: [],
          },
        },
        dislikes: {
          $cond: {
            if: {
              $gt: [{ $size: "$dislikes" }, 0],
            },
            then: { $first: "$dislikes.dislikeOwners" },
            else: [],
          },
        },
      },
    },
    // fetch owner details
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
      $unwind: "$owner",
    },
    // added like fields
    {
      $project: {
        videoFile: 1,
        title: 1,
        description: 1,
        duration: 1,
        thumbnail: 1,
        views: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        totalLikes: {
          $size: "$likes",
        },
        totalDisLikes: {
          $size: "$dislikes",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likes"],
            },
            then: true,
            else: false,
          },
        },
        isDisLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$dislikes"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  if (!video.length > 0) throw new ApiError(400, "No video found");

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video sent successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  //get video
  //search in db
  //updated video details
  //return updated video details

  try {
    if (!isValidObjectId(videoId)) {
      throw new ApiError(400,  "Invalid video id");
    }

    const { title, description } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      throw new ApiError(400,  "Invalid title");
    }
      
      if(!description || typeof description !== "string" || description.trim=='') {
      throw new ApiError(400,  "Invalid description");
    }

    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) {
      throw new ApiError(400,  "Thumbnail file is required");
    }
    const thumbnailOnCloudinary = await uploadPhotoOnCloudinary(thumbnailLocalPath);

    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        owner: req.user?._id,
      },
      {
        title: title,
        description: description,
        thumbnail: thumbnailOnCloudinary?.url,
      },
      { new: true }
    );

    if (!video) {
      throw new ApiError(
        404,
        
        "Video not found or you are not allowed to update this video"
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video updated successfully"));
  } catch (error) {
    console.error("Error in updating video:", error);
    throw new ApiError(500, error.message, "Interal server error");
  }
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  //get video
  //search in db
  //ownership check
  //delete video

  try {
    if (!isValidObjectId(videoId)) {
      throw new ApiError(400,  "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(404,  "Video not found");
    }

    // if (!video?.Owner?.includes(req.user?._id)) {
    //   throw new ApiError(403,  "You are not allowd to delete this video");
    // }

    const videoFile = await deleteVideoOnCloudinary(video.videoFile, "video");
    const thumbnail = await deleteImageOnCloudinary(video.thumbnail, "img");

    if (!videoFile && !thumbnail) {
      throw new ApiError(
        400,
        "thumbnail or videoFile is not deleted from cloudinary"
      );
    }

    await Video.findByIdAndDelete(videoId);

    return res
      .status(200)
      .json(new ApiResponse(200,  "Video deleted successfully"));
  } catch (error) {
    console.error("Error in deleting video:", error);
    throw new ApiError(500, error.message, "Internal server error");
  }
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  //TODO: toggle publish status
  //search video in db
  //if exists then toggle status uploaded to cloudinary
  //else throw error
  //return the video details

  const video = await Video.findOne({
    _id: videoId,
    owner: req.user?._id,
  });

  if (!video) {
    throw new ApiError(404,  "Video not found");
  }

  video.isPublished = !video.isPublished;
  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video published status updated successfully")
    );
});

const updateView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) throw new ApiError(400, "videoId required");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(400, "Video not found");

  video.views += 1;
  const updatedVideo = await video.save();
  if (!updatedVideo) throw new ApiError(400, "Error occurred on updating view");

  let watchHistory;
  if (req.user) {
    watchHistory = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $push: {
          watchHistory: new mongoose.Types.ObjectId(videoId),
        },
      },
      {
        new: true,
      }
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isSuccess: true, views: updatedVideo.views, watchHistory },
        "Video views updated successfully"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
  updateView
};