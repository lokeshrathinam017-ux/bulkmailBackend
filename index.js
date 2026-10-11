const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const { google } = require('googleapis')

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect("mongodb+srv://lokeshrathinam01_db_user:lNkwkyMr7t2QIglT@cluster0.bmqkrz5.mongodb.net/passkey?appName=Cluster0")
.then(function(){
    console.log("DB Success")
})
.catch(function(){
    console.log("DB Failed")
})

const credential = mongoose.model("credential", {}, "bulkmail")
const User = mongoose.model("User", {
    name: String,
    email: String,
    pass: String
}, "users")

const History = mongoose.model("History", {
    msg: String,
    emailList: Array,
    date: String
}, "sent_history")

app.post('/signup', async (req, res) => {
    try {
        const { name, email, pass } = req.body
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.json({ success: false, message: "Email already registered!" })
        }
        const newUser = new User({ name, email, pass })
        await newUser.save()
        res.json({ success: true, message: "Account created successfully!" })
    } catch (error) {
        res.json({ success: false, message: "Error creating account" })
    }
})

app.post('/login', async (req, res) => {
    try {
        const { email, pass } = req.body
        const user = await User.findOne({ email, pass })
        if (user) {
            res.json({ success: true, user })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        res.json({ success: false, message: "Server error" })
    }
})

app.get('/senthistory', async (req, res) => {
    try {
        const history = await History.find()
        res.json(history)
    } catch (error) {
        res.json([])
    }
})

function makeBody(to, from, subject, message) {
    const str = [
        `To: ${to}`,
        `From: ${from}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        message
    ].join('\n');

    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

app.post('/sendemail', async (req, res) => {
    const msg = req.body.msg
    const emailList = req.body.emailList
    
    try {
        const credData = await credential.find()
        const creds = credData[0].toJSON()

        const oAuth2Client = new google.auth.OAuth2(
            creds.clientId,
            creds.clientSecret,
            creds.redirectUri || "https://developers.google.com/oauthplayground"
        );

        oAuth2Client.setCredentials({ refresh_token: creds.refreshToken });
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        for (let i = 0; i < emailList.length; i++) {
            const rawMessage = makeBody(emailList[i], creds.user, "A Message from Bulk Mail App", msg);
            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: rawMessage
                }
            });
            console.log("Email Sent via Gmail API to : " + emailList[i])
        }

        const newHistory = new History({
            msg: msg,
            emailList: emailList,
            date: new Date().toLocaleString()
        })
        await newHistory.save()

        res.send(true)
    } catch (error) {
        console.log("Gmail API Error:", error)
        res.send(false)
    }
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log("Server Started...")
})