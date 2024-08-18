
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookiePerser = require("cookie-parser") ;
const jwt = require("jsonwebtoken") ;
const bcrypt = require('bcryptjs') ;
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5555 ;
const app = express() ;

app.use(cors({
  origin : [
    'http://localhost:5173' ,
  ],
  credentials : true ,
})) ;
app.use(express.json()) ;
app.use(cookiePerser()) ;
require("dotenv").config() ;


const uri = `mongodb+srv://rahat495:${process.env.DB_PASS}@cluster0.w0yjihf.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("PH-task").collection("users") ;
    const transactionsCollection = client.db("PH-task").collection("transactions") ;
    const cashInRequestsCollection = client.db("PH-task").collection("cashInRequests") ;
    const cashOutRequestsCollection = client.db("PH-task").collection("cashOutRequests") ;

    app.get('/isLogin' , async (req , res) => {
      const {token} = req.query ;
      const {email} = jwt.decode(token) ;
      const emailValue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ;
      const user = await usersCollection.findOne(emailValue ? {email} : {phone : email}) ;
      if(user?.isLogin){
        return res.send({isLogin : true , email : user?.email , phone : user?.phone})
      }
      else{
        return res.send({isLogin : false})
      }
    })

    app.get('/currentUserData' , async (req , res) => {
      const {email , phone} = req.query ;
      const currentUser = await usersCollection.findOne({email , phone}) ;
      res.send(currentUser) ;
    })

    app.get('/userTransactions' , async (req , res) => {
      const {email , phone} = req.query ;
      const userTransactions = await transactionsCollection.find({$and : [{senderEmail : email} , {senderPhone : phone}]}).sort({sortableDate : -1}).limit(10).toArray() ;
      res.send(userTransactions) ;
    })

    app.get('/agentTransactions' , async (req , res) => {
      const {email , phone} = req.query ;
      const isValidInfo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ;
      const agentTransactions = await transactionsCollection.find(isValidInfo ? {to : email} : {to : phone}).sort({sortableDate : -1}).limit(10).toArray() ;
      res.send(agentTransactions) ;
    })

    app.get('/adminTransactions' , async (req , res) => {
      const {email , phone} = req.query ;
      const agentTransactions = await transactionsCollection.find().sort({sortableDate : -1}).toArray() ;
      res.send(agentTransactions) ;
    })

    app.get('/cashInRequests' , async (req , res) => {
      const {phone} = req.query ;
      const inRequests = await cashInRequestsCollection.find({agent : phone}).sort({sortableDate : -1}).toArray() ;
      res.send(inRequests) ;
    })

    app.get('/cashOutRequests' , async (req , res) => {
      const {phone} = req.query ;
      const inRequests = await cashOutRequestsCollection.find({agent : phone}).sort({sortableDate : -1}).toArray() ;
      res.send(inRequests) ;
    })

    app.get('/users' , async (req , res) => {
      const {name , phone , activity} = req.query ;
      let query = {} ;
      if(name){
        query.name = { $regex: name, $options: 'i' } ;
      }
      else if(phone){
        query.phone = { $regex: phone, $options: 'i' } ;
      }
      else if(activity && activity === 'all'){
        query.activity ;
      }
      else if(activity && activity === 'active'){
        query.isBlock = activity ;
      }
      else if(activity && activity === 'blocked'){
        query.isBlock = activity ;
      }
      const users = await usersCollection.find(query).toArray() ;
      res.send(users) ;
    })

    app.post('/login' , async (req , res) => {
      const {pin , query} = req.body ;
      const queryValue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query) ;
      const userData = await usersCollection.findOne(queryValue ? {email : query} : {phone : query})
      
      if(userData?.hashPin){
        const isValid = bcrypt.compareSync(pin , userData?.hashPin) ;
        if(isValid){
          const update = await usersCollection.updateOne(queryValue ? {email : query} : {phone : query} , {$set : {isLogin : true}}) ;
          return res.send({success : true , message : "pin matched !"}) ;
        }
        else{
          return res.send({success : false , message : "pin unMatched !"}) ;
        }
      }
      else{
        return res.send({success : false , message : "Email or phone unMatched !"})
      }
    })

    app.post('/register' , async (req , res) => {
        const { pin , name , email , phone , userStatus , balance , role , isLogin } = req.body ;
        const isAxist = await usersCollection.findOne({email} , {phone}) ;
        if(isAxist){
          return res.send({message : "already axist" , success : false})  
        }
        const hashPin = await bcrypt.hash(pin , 10) ;
        const data = {
          role,
          name , 
          email,
          phone ,
          balance,
          isLogin ,
          hashPin ,
          userStatus,
        }

        const result = await usersCollection.insertOne(data) ;
        if(result?.insertedId){
          const update = await usersCollection.updateOne({email} , {$set : {isLogin : true}}) ;
        }
        res.send(result) ;
    })

    app.post('/jwt' , async (req , res) => {
      const user = req.body ;
      const token = jwt.sign(user , process.env.SECRET_CODE , {expiresIn : '10s'}) ;
      res.cookie("token" , token , {
        httpOnly : true ,
        secure : process.env.NODE_ENV === "production" ? true : false ,
        sameSite : process.env.NODE_ENV === 'production' ? 'none' : 'strict' , 
      }).send({success : true , token}) ;
    })

    app.post('/sendMoney' , async (req , res) => {
      const sendingData = req.body ;
      const {sendingInfo , email , phone , amount , balance , name} = sendingData ;
      const isValidInfo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendingInfo) ;
      const isValidUser = await usersCollection.findOne(isValidInfo ? {email : sendingInfo} : {phone : sendingInfo}) ;
      if(isValidUser?.email){
        const uCUB = await usersCollection.updateOne( {$and : [ {email} , {phone} ]} , {$set : {balance : balance - amount}}) ;
        const uSUB = await usersCollection.updateOne( isValidInfo ? {email : sendingInfo} : {phone : sendingInfo} , {$set : {balance : amount > 100 ? isValidUser?.balance + (amount - 5) : isValidUser?.balance + amount}}) ;
        const transactionInfo = {
          senderName : name , 
          senderEmail : email , 
          senderPhone : phone , 
          to : sendingInfo ,
          date : new Date().toLocaleDateString(),
          time : new Date().toLocaleTimeString(),
          sortableDate : new Date().toISOString(),
          transactionType : "sendMoney" ,
          amount ,
        }
        const addTransaction = await transactionsCollection.insertOne(transactionInfo) ;
        return res.send(addTransaction) ;
      }
      else{
        return res.send(`Invalid ${isValidInfo ? "Email" : "Number"} !`) ;
      }
    })

    app.post('/cashIn' , async (req , res) => {
      const sendingData = req.body ;
      const {sendingInfo , email , phone , amount , balance , name} = sendingData ;
      const isValidInfo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendingInfo) ;
      const isValidUser = await usersCollection.findOne(isValidInfo ? {email : sendingInfo} : {phone : sendingInfo}) ;

      if(isValidUser?.email && isValidUser?.role === "agent"){
        const cashInInfo = {
          requesterName : name , 
          requesterEmail : email , 
          requesterPhone : phone , 
          agent : sendingInfo ,
          date : new Date().toLocaleDateString(),
          time : new Date().toLocaleTimeString(),
          sortableDate : new Date().toISOString(),
          transactionType : "cashIn" ,
          amount ,
          requestStatus : "pending" ,
          isAlreadyDone : false ,
        }

        const addCashInReq = await cashInRequestsCollection.insertOne(cashInInfo) ;
        return res.send(addCashInReq) ;
      }
      else{
        return res.send(`Invalid ${isValidInfo ? "Email" : "Number"} !`) ;
      }
    })

    app.post('/cashOut' , async (req , res) => {
      const sendingData = req.body ;
      const {sendingInfo , email , phone , amount , name} = sendingData ;
      const isValidInfo = /^[^\s@]+@[^\s@]+\  .[^\s@]+$/.test(sendingInfo) ;
      const isValidUser = await usersCollection.findOne(isValidInfo ? {email : sendingInfo} : {phone : sendingInfo}) ;

      if(isValidUser?.email && isValidUser?.role === "agent"){
        const cashInInfo = {
          requesterName : name , 
          requesterEmail : email , 
          requesterPhone : phone , 
          agent : sendingInfo ,
          date : new Date().toLocaleDateString(),
          time : new Date().toLocaleTimeString(),
          sortableDate : new Date().toISOString(),
          transactionType : "cashOut" ,
          amount ,
          requestStatus : "pending" ,
          isAlreadyDone : false ,
        }

        const addCashInReq = await cashOutRequestsCollection.insertOne(cashInInfo) ;
        return res.send(addCashInReq) ;
      }
      else{
        return res.send(`Invalid ${isValidInfo ? "Email" : "Number"} !`) ;
      }
    })

    app.put('/acceptCashIn' , async (req , res) => {
      const {id} = req.body ;
      const {requesterEmail , requesterPhone , requesterName , agent , amount} = await cashInRequestsCollection.findOne({_id : new ObjectId(id)}) ;
      const isValidInfo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agent) ;
      const acceptCashIn = await cashInRequestsCollection.updateOne({_id : new ObjectId(id)} , {$set : { requestStatus : "accepted" , isAlreadyDone : true }}) ;
      const agentId = await usersCollection.findOne(isValidInfo ? {email : agent} : {phone : agent}) ;
      const reqUser = await usersCollection.findOne({$and : [{email : requesterEmail} , {phone : requesterPhone}]}) ;
      const uRUB = await usersCollection.updateOne({$and : [{email : requesterEmail} , {phone : requesterPhone}]} , {$set : { balance : reqUser?.balance + amount }})
      const uAgenyB = await usersCollection.updateOne(isValidInfo ? {email : agent} : {phone : agent} , {$set : { balance : agentId?.balance - amount }})
      const transactionInfo = {
        senderName : requesterName , 
        senderEmail : requesterEmail , 
        senderPhone : requesterPhone , 
        to : agent ,
        date : new Date().toLocaleDateString(),
        time : new Date().toLocaleTimeString(),
        sortableDate : new Date().toISOString(),
        transactionType : "cashIn" ,
        amount ,
      }
      await transactionsCollection.insertOne(transactionInfo) ;
      res.send({message : "request accepted !" , success : true}) ;
    })
    
    app.put('/logOut' , async (req , res) => {
      const {token} = req.body ;
      const {email} = jwt.decode(token) ;
      const emailValue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ;
      const currentUser = await usersCollection.findOne(emailValue ? {email} : {phone : email}) ;
      if(currentUser?.isLogin){
        const updateValue = await usersCollection.updateOne(emailValue ? {email} : {phone : email} , { $set : { isLogin : false }}) ;
        res.send({message : "logOut Success Fully !" , success : true}) ;
      }
    })

    app.put('/acceptCashOut' , async (req , res) => {
      const {id} = req.body ;
      const {requesterEmail , requesterPhone , requesterName , agent , amount} = await cashOutRequestsCollection.findOne({_id : new ObjectId(id)}) ;
      const isValidInfo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agent) ;
      const acceptCashOut = await cashOutRequestsCollection.updateOne({_id : new ObjectId(id)} , {$set : { requestStatus : "accepted" , isAlreadyDone : true }}) ;
      const agentId = await usersCollection.findOne(isValidInfo ? {email : agent} : {phone : agent}) ;
      const reqUser = await usersCollection.findOne({$and : [{email : requesterEmail} , {phone : requesterPhone}]}) ;
      const uRUB = await usersCollection.updateOne({$and : [{email : requesterEmail} , {phone : requesterPhone}]} , {$set : { balance : reqUser?.balance - amount }})
      const uAgenyB = await usersCollection.updateOne(isValidInfo ? {email : agent} : {phone : agent} , {$set : { balance : agentId?.balance + amount }})
      const transactionInfo = {
        senderName : requesterName , 
        senderEmail : requesterEmail , 
        senderPhone : requesterPhone , 
        to : agent ,
        date : new Date().toLocaleDateString(),
        time : new Date().toLocaleTimeString(),
        sortableDate : new Date().toISOString(),
        transactionType : "cashOut" ,
        amount ,
      }
      await transactionsCollection.insertOne(transactionInfo) ;
      res.send({message : "request accepted !" , success : true}) ;
    })

    app.patch('/sendUserBounes' , async (req , res) => {
      const {id , role} = req.body ;
      const currentUser = await usersCollection.findOne({_id : new ObjectId(id)}) ;
      if(role === 'agent'){
        const sendBounes = await usersCollection.updateOne({_id : new ObjectId(id)} , { $set : { isGivedBounes : true , balance : currentUser?.balance + 10000 } }) 
        return res.send(sendBounes) ;
      }
      else if(role === 'user'){
        const sendBounes = await usersCollection.updateOne({_id : new ObjectId(id)} , { $set : { isGivedBounes : true , balance : currentUser?.balance + 100 } }) 
        return res.send(sendBounes) ;
      }
    })

    app.patch('/updateUserStatus' , async (req , res) => {
      const {id , status} = req.body ;
      const updateUserStatus = await usersCollection.updateOne({_id : new ObjectId(id)} , status === 'active' ? { $set : {userStatus : "pending"} } : { $set : {userStatus : "active"} }) ;
      res.send(updateUserStatus) ;
    })

    app.patch('/blockAUser' , async (req , res) => {
      const {id , isBlock} = req.body ;
      const blockUser = await usersCollection.updateOne({_id : new ObjectId(id)} , { $set : isBlock === "active" ? { isBlock : "blocked" } : { isBlock : "active" } }) ;
      res.send(blockUser) ;
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/' , (req , res) => {
    res.send("school server is running !")
})

app.listen(port , () => {
    console.log(`the server is running at port ${port}`);
})
