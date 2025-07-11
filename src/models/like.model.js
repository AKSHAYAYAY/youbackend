 import mongoose, {Schema, SchemaType} from "mongoose";

 const LikeSchema = new Schema({
    video :{
        type : Schema.Types.ObjectId ,
        ref : "Video"
    },
     comment :{
        type : Schema.Types.ObjectId ,
        ref : "Comment"
    },
     tweet :{
        type : Schema.Types.ObjectId ,
        ref : "Tweet"
    },
     Likedby :{
        type : Schema.Types.ObjectId ,
        ref : "User"
    },
 }, {timestamps:true,})


 export const Like = mongoose.model("Like", LikeSchema)