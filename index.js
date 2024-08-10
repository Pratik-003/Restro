var express = require("express");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var path = require("path");
var session = require("express-session");
var ejs = require("ejs");
var multer = require("multer");
require('dotenv').config();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Use sessions to track user login status
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true
}));

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to Database"))
    .catch(err => console.log("Error in Connecting to Database", err));

// Set up Multer for file uploads
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

var upload = multer({ storage: storage });

// User schema
var userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    photo: String 
});

var User = mongoose.model('User', userSchema);

// Sign-up route
app.post("/sign_up", async (req, res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;

    try {
        // Check if the email is already registered
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(409).send("Email already registered");
        }

        var data = new User({
            name: name,
            email: email,
            password: password
        });

        await data.save();
        console.log("Record Inserted Successfully");
        req.session.user = data;
        return res.redirect('/profile');
    } catch (err) {
        console.error("Error in inserting record: ", err);
        return res.status(500).send("Error in inserting record");
    }
});

// Login route
app.post("/login", async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    try {
        const user = await User.findOne({ email: email, password: password });
        if (!user) {
            return res.status(401).send("Invalid credentials");
        }
        // Save user data in session
        req.session.user = user;
        return res.redirect('/profile');
    } catch (err) {
        console.error("Error occurred while checking credentials: ", err);
        return res.status(500).send("Error occurred while checking credentials");
    }
});

// Profile route with photo upload
app.post("/upload_photo", upload.single('photo'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized access");
    }

    var photoPath = '/uploads/' + req.file.filename;

    try {
        const user = await User.findByIdAndUpdate(req.session.user._id, { photo: photoPath }, { new: true });
        req.session.user = user;
        res.redirect('/profile');
    } catch (err) {
        console.error("Error occurred while uploading photo: ", err);
        return res.status(500).send("Error occurred while uploading photo");
    }
});

// Profile route
app.get("/profile", (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Unauthorized access");
    }
    res.render('profile', { user: req.session.user });
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error in logging out: ", err);
            return res.status(500).send("Error in logging out");
        }
        res.redirect('/');
    });
});

// Serve login page by default
app.get("/", (req, res) => {
    res.set({
        "Allow-access-Allow-Origin": '*'
    });
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(3000, () => {
    console.log("Listening on port 3000");
});
