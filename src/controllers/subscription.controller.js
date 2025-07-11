import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new apiError(400, "Invalid channel id");
  }

  const existingSubscription = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user._id,
  });

  if (existingSubscription) {
    await existingSubscription.deleteOne();
    return res
      .status(200)
      .json(new apiResponse(200, {}, "Unsubscribed successfully"));
  } else {
    const newSubscription = await Subscription.create({
      channel: channelId,
      subscriber: req.user._id,
    });
    return res
      .status(201)
      .json(new apiResponse(201, newSubscription, "Subscribed successfully"));
  }
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new apiError(400, "Invalid channel id");
  }

  const subscribers = await Subscription.find({
    channel: channelId,
  }).populate("subscriber", "fullName avatar username");

  const enrichedSubscribers = await Promise.all(
    subscribers.map(async (sub) => {
      const subscribersCount = await Subscription.countDocuments({
        subscriber: sub.subscriber._id,
      });

      return {
        ...sub._doc,
        subscriber: {
          ...sub.subscriber._doc,
          subscribersCount,
        },
      };
    })
  );

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        { subscribers: enrichedSubscribers },
        "Subscribers fetched successfully"
      )
    );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new apiError(400, "Invalid subscriber id");
  }

  const subscribedChannels = await Subscription.find({
    subscriber: subscriberId,
  }).populate("channel", "fullName avatar username");

  if (!subscribedChannels.length) {
    throw new apiError(404, "No channels found");
  }

  const enrichedSubscriptions = await Promise.all(
    subscribedChannels.map(async (sub) => {
      if (sub.channel) {
        const subscribersCount = await Subscription.countDocuments({
          channel: sub.channel._id,
        });

        return {
          ...sub._doc,
          channel: {
            ...sub.channel._doc,
            subscribersCount,
          },
        };
      } else {
        return sub;
      }
    })
  );

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        { subscribedChannels: enrichedSubscriptions },
        "Subscribed channels fetched successfully"
      )
    );
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
};
