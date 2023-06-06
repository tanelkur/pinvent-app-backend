const asyncHandler = require("express-async-handler");
const Product = require("../models/productModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const cloudinary = require("cloudinary").v2;

// CREATE PRODUCT
const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, quantity, category, price, description } = req.body;
  // Validation
  if (!name || !quantity || !category || !price || !description) {
    res.status(400);
    throw new Error("Please fill in all fields");
  }
  // Handle image upload
  let fileData = {};
  if (req.file) {
    // Save to cloudinary beacuse render.com doesnt support
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: "Pinvent App",
        resource_type: "image",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }

    fileData = {
      fileName: req.file.originalname,
      filePath: uploadedFile.secure_url, // req.file.path, (Kui ei kasuta cloudinaryt)
      fileType: req.file.mimetype,
      fileSize: fileSizeFormatter(req.file.size, 2),
    };
  }
  // Create product
  const product = await Product.create({
    user: req.user.id,
    name,
    sku,
    category,
    quantity,
    price,
    description,
    image: fileData,
  });
  res.status(201).json(product);
});

// GET ALL PRODUCTS
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ user: req.user.id }).sort("-createdAt");
  res.status(200).json(products);
});

// GET SINGLE PRODUCT
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // If product doesnt match to user
  if (product.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  res.status(200).json(product);
});

// DELETE PRODUCT
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // If product doesnt match to user
  if (product.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  await Product.deleteOne({ _id: req.params.id });
  res.status(200).json({ message: "Product deleted" });
});

// UPDATE PRODUCT
const updateProduct = asyncHandler(async (req, res) => {
  const { name, quantity, category, price, description } = req.body;
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // If product doesnt match to user
  if (product.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Handle image upload
  let fileData = {};
  if (req.file) {
    // Save to cloudinary beacuse render.com doesnt support
    let uploadedFile;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: "Pinvent App",
        resource_type: "image",
      });
    } catch (error) {
      res.status(500);
      throw new Error("Image could not be uploaded");
    }
    // End of cloudinary upload

    fileData = {
      fileName: req.file.originalname,
      filePath: uploadedFile.secure_url, // req.file.path, (Kui ei kasuta cloudinaryt)
      fileType: req.file.mimetype,
      fileSize: fileSizeFormatter(req.file.size, 2),
    };
  }
  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(
    {
      _id: id,
    },
    {
      name,
      category,
      quantity,
      price,
      description,
      image: Object.keys(fileData).length === 0 ? product?.image : fileData,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  res.status(201).json(updatedProduct);
});

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  deleteProduct,
  updateProduct,
};
