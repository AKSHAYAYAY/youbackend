import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    throw new apiError(400, "Name and description are required");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user._id,
  });

  if (!playlist) {
    throw new apiError(500, "Failed to create playlist");
  }

  return res
    .status(201)
    .json(new apiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new apiError(400, "Invalid user id");
  }

  const playlists = await Playlist.find({ owner: userId })
  .populate({
      path: "videos",
      select: "title thumbnail duration owner",
      populate: {
        path: "owner",
        select: "fullName username avatar",
      },
    })
    .populate("owner", "fullName username avatar");

  if (!playlists) {
    throw new apiError(404, "No playlists found");
  }

  return res
    .status(200)
    .json(new apiResponse(200, playlists, "Playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlist id");
  }

  const playlist = await Playlist.findById(playlistId) 
  .populate({
      path: "videos",
      select: "title thumbnail duration owner",
      populate: {
        path: "owner",
        select: "fullName username avatar",
      },
    })
    .populate("owner", "fullName username avatar");


  if (!playlist) {
    throw new apiError(404, "No playlist found");

  }

  return res
    .status(200)
    .json(new apiResponse(200, playlist, "Playlist fetched successfully"));
});

/*const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlistId");
  }

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid videoId");
  }

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    {
      new: true,
    }
  );

  if (!playlist) throw new apiError(500, "Error while adding video to playlist");

  return res.status(200).json(
    new apiResponse(
      200,
      { isAdded: true },
      "Video added to playlist successfully"
    )
  );
});*/
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlistId");
  }

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid videoId");
  }

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    {
      new: true,
    }
  )
    .populate({
      path: "videos",
       select: "title thumbnail duration owner",
      populate: {
        path: "owner", // also populate owner of each video if needed
        select: "fullName username avatar",
      },
    })
    .populate("owner", "fullName username avatar");

  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

  res.status(200).json(playlist);
});


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) && !isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid playlistId or videoId");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new apiError(404, "No playlist found");
  }

  if (!playlist.videos.includes(videoId)) {
    throw new apiError(404, "Video not found in playlist");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new apiError(
      403,
      "You are not allowed to remove video from this playlist"
    );
  }

  playlist.videos.pull(videoId);
  const checkSaved = await playlist.save();

  if (!checkSaved) {
    throw new apiError(500, "Failed to remove video from playlist");
  }

  return res.status(200).json(
    new apiResponse(
      200,
      { isSuccess: true },
      "Video removed from playlist successfully"
    )
  );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlistId");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new apiError(404, "No playlist found");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new apiError(403, "You are not allowed to delete this playlist");
  }

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

  if (!deletedPlaylist) {
    throw new apiError(500, "Failed to delete playlist");
  }

  return res.status(200).json(new apiResponse(200, "Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid playlistID");
  }

  if (!name && !description) {
    throw new apiError(400, "Name and description are required");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new apiError(404, "No playlist found");
  }

  if (!playlist.owner.equals(req.user._id)) {
    throw new apiError(403, "You are not allowed to update this playlist");
  }

  playlist.name = name;
  playlist.description = description;

  const checkUpdated = await playlist.save();

  if (!checkUpdated) {
    throw new apiError(500, "Failed to update playlist");
  }

  return res
    .status(200)
    .json(new apiResponse(200, playlist, "Playlist updated successfully"));
});

const getVideoSavePlaylists = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new apiError(400, "Valid videoId required");
  }

  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $project: {
        name: 1,
        isVideoPresent: {
          $cond: {
            if: { $in: [new mongoose.Types.ObjectId(videoId), "$videos"] },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new apiResponse(200, playlists, "Playlists sent successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
  getVideoSavePlaylists,
};
