const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

// HELPER FUNCTIONS
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};
const responseCookie = (res, token) => {
  return res.cookie("token", token, {
    path: "/",
    httpOnly: true,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    sameSite: "none",
    secure: true,
  });
};

// REGISTER USER
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, photo, phone, bio } = req.body;

  // Validation
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }
  if (password.length < 4) {
    res.status(400);
    throw new Error("Password must be at least 4 characters long");
  }
  // Check if user already exists in database
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("Email has already been registered");
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    photo,
    phone,
    bio,
  });

  // Generate token
  const token = generateToken(user._id);
  // Send HTTP-only cookie
  responseCookie(res, token);
  // res.cookie("token", token, {
  //   path: "/",
  //   httpOnly: true,
  //   expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
  //   sameSite: "none",
  //   secure: true,
  // });

  if (user) {
    const { _id, name, email, photo, phone, bio } = user;
    res.status(201).json({
      _id,
      name,
      email,
      photo,
      phone,
      bio,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// LOGIN USER
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    res.status(400);
    throw new Error("Please add email and password");
  }
  // Check if user exists
  const user = await User.findOne({ email });
  if (!user) {
    res.status(400);
    throw new Error("User not found, please sign up");
  }
  //Check if password is correct
  const passwordIsCorrect = await bcrypt.compare(password, user.password);
  // Generate token
  const token = generateToken(user._id);
  // Send HTTP-only cookie
  responseCookie(res, token);

  if (user && passwordIsCorrect) {
    const { _id, name, email, photo, phone, bio } = user;
    res.status(200).json({
      _id,
      name,
      email,
      photo,
      phone,
      bio,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Password does not match email");
  }
});

// LOGOUT USER
const logout = asyncHandler(async (req, res) => {
  // Modify cookie, thats why emty string. Expires now
  res.cookie("token", "", {
    path: "/",
    httpOnly: true,
    expires: new Date(0),
    sameSite: "none",
    secure: true,
  });
  // Delete cookie also works
  // res.clearCookie("token");
  return res.status(200).json({ message: "Successfully logged out" });
});

// GET USER DATA
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    const { _id, name, email, photo, phone, bio } = user;
    res.status(200).json({
      _id,
      name,
      email,
      photo,
      phone,
      bio,
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

// GET LOGIN STATUS
const loginStatus = asyncHandler(async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json(false);
  }
  // Verify token
  const verified = jwt.verify(token, process.env.JWT_SECRET);
  if (verified) {
    return res.json(true);
  }
  return res.json(false);
});

// UPDATE USER
const updateuser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    const { name, email, photo, phone, bio } = user;
    user.email = email;
    user.name = req.body.name || name;
    user.phone = req.body.phone || phone;
    user.photo = req.body.photo || photo;
    user.bio = req.body.bio || bio;

    const updatedUser = await user.save();
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      photo: updatedUser.photo,
      phone: updatedUser.phone,
      bio: updatedUser.bio,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// CHANGE PASSWORD
const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { oldPassword, password } = req.body;
  // Validate
  if (!user) {
    res.status(400);
    throw new Error("User not found, please signup");
  }
  if (!oldPassword || !password) {
    res.status(400);
    throw new Error("Please add old and new password");
  }
  // Check if oldPassword password is correct
  const passwordIsCorrect = await bcrypt.compare(oldPassword, user.password);
  // Save new password
  if (user && passwordIsCorrect) {
    user.password = password;
    await user.save();
    res.status(200).send("Password change successful");
  } else {
    res.status(400);
    throw new Error("Old password is incorrect");
  }
});

// RESET PASSWORD WITH EMAIL
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Find user with that email
  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error("User does not exist");
  }
  // Delete token if it exists already
  let token = await Token.findOne({ userId: user._id });
  if (token) {
    await token.deleteOne();
  }
  // Create reset token
  let resetToken = crypto.randomBytes(32).toString("hex") + user._id;
  console.log(resetToken);

  // Hash token before saving to database
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  // Save token do database
  await new Token({
    userId: user._id,
    token: hashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  }).save();
  // Construct reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
  // Reset email
  const message = `
  <h2> Hello ${user.name} </h2>
  <p>Please use the url below to reset your password</p>
  <p>Reset link is valid for 30 minutes</p>
  <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
  <p>Best regards,</p>
  <p>Your Pinvent</p>
  `;
  const subject = "Password reset request from Pinvent";
  const send_to = user.email;
  const sent_from = process.env.EMAIL_USER;
  //const reply_to = process.env.EMAIL_USER;
  try {
    await sendEmail(subject, message, send_to, sent_from);
    res.status(200).json({ success: true, message: "Reset email sent" });
  } catch (error) {
    res.status(500);
    throw new Error("Email not sent, please try again");
  }
});

// RESET PASSWORD LINK IN EMAIL
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.params;

  // Hash token and compare with token in database
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const userToken = await Token.findOne({
    token: hashedToken,
    expiresAt: { $gt: Date.now() }, // Greater than current time
  });
  if (!userToken) {
    res.status(404);
    throw new Error("Ivalid or expired token");
  }
  // Find user
  const user = await User.findOne({ _id: userToken.userId });
  user.password = password;
  await user.save();
  res.status(200).json({
    message: "Password change successful. Please login.",
  });
});

module.exports = {
  registerUser,
  loginUser,
  logout,
  getUser,
  loginStatus,
  updateuser,
  changePassword,
  forgotPassword,
  resetPassword,
};
