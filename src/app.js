import express, { urlencoded } from "express" ; 
import cors from "cors"
import cookieParser from "cookie-parser";


const app =  express() ; 
app.use(cors({
    origin: process.env.CORS_ORIGIN ,
    credentials: true 
}
     
)) ; 

app.use (express.json({limit:"100kb"}));
app.use(express.urlencoded({extended: true })) 
app.use(express.static("public"))

app.use(cookieParser())

import userRouter from './routes/user.routes.js'

app.use("/api/v1/users" , userRouter) 

export {app} ; 



// http://localhost:3000/api/v1/users/register