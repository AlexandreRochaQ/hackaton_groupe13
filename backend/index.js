

const express=require("express"); const app=express(); app.use(require("cors")()); 
app.use(express.json()); app.get("/health",(_,res)=>res.json({status:"ok"})); 
app.listen(4000,()=>console.log("Backend ready"));

