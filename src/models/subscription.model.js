import mongoose from "mongoose";


const subscriptionSchema = new Schema({
subscriber : {
    type : Schema.Types.ObjectId ,
    ref : "User"
} , // who is subscribing ,

channel : {
    type : Schema.Types.ObjectId ,
    ref : "User"
}  // to whom subscribtion is made 
}, {timestamps: true })


export const Subsscription = mongoose.model("Subscription" ,
    subscriptionSchema
)