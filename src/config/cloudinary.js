require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'social-network/images',
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
        format: 'webp', // Force conversion to WebP
        transformation: [{ flags: 'strip_profile' }] // Ensure metadata is removed
    }
});


const audioStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'social-network/audios',
        resource_type: 'video',
        allowed_formats: ['mp3', 'wav', 'ogg', 'webm', 'm4a']
    }
});

const uploadImage = multer({
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadAudio = multer({
    storage: audioStorage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

module.exports = { cloudinary, uploadImage, uploadAudio };
