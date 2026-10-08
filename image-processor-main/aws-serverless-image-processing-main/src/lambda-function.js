const AWS = require('aws-sdk');
const sharp = require('sharp');

const rekognition = new AWS.Rekognition();

exports.handler = async (event) => {
    try {
        const { imageKey, feature } = JSON.parse(event.body);

        // Fetch the image from S3
        const s3 = new AWS.S3();
        const originalImage = await s3.getObject({
            Bucket: 'your-source-bucket',
            Key: imageKey,
        }).promise();

        // Convert the image buffer to base64
        const imageBase64 = originalImage.Body.toString('base64');

        // Call Amazon Rekognition based on the specified feature
        let rekognitionParams = {};
        switch (feature) {
            case 'smartCropping':
                rekognitionParams = {
                    Image: {
                        Bytes: Buffer.from(imageBase64, 'base64'),
                    },
                    Attributes: ['ALL'],
                };
                const faces = await rekognition.detectFaces(rekognitionParams).promise();
                const cropParams = calculateCropParameters(faces);
                const croppedImageBuffer = await sharp(originalImage.Body)
                    .extract({ left: cropParams.left, top: cropParams.top, width: cropParams.width, height: cropParams.height })
                    .toBuffer();
                return createResponse(croppedImageBuffer);
            case 'contentModeration':
                rekognitionParams = {
                    Image: {
                        Bytes: Buffer.from(imageBase64, 'base64'),
                    },
                    MinConfidence: 80,
                };
                const moderationLabels = await rekognition.detectModerationLabels(rekognitionParams).promise();
                if (moderationLabels.ModerationLabels.length > 0) {
                    // Image contains inappropriate content, blur it
                    const blurredImageBuffer = await sharp(originalImage.Body).blur(10).toBuffer();
                    return createResponse(blurredImageBuffer);
                } else {
                    // Image is safe
                    return createResponse(originalImage.Body);
                }
            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify('Invalid feature specified'),
                };
        }
    } catch (error) {
        console.error('Error processing image:', error);
        return {
            statusCode: 500,
            body: JSON.stringify('Internal Server Error'),
        };
    }
};

function calculateCropParameters(faces) {
    // Calculate crop parameters based on detected faces
    // This is a simple example, adjust based on your specific use case
    if (faces.FaceDetails.length > 0) {
        const face = faces.FaceDetails[0]; // Use the first detected face
        return {
            left: Math.floor(face.BoundingBox.Left * 100),
            top: Math.floor(face.BoundingBox.Top * 100),
            width: Math.floor(face.BoundingBox.Width * 100),
            height: Math.floor(face.BoundingBox.Height * 100),
        };
    } else {
        // If no faces detected, return default parameters
        return { left: 0, top: 0, width: 100, height: 100 };
    }
}

function createResponse(imageBuffer) {
    // Create the response object with the processed image
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'image/jpeg', // Adjust the content type based on your image format
        },
        isBase64Encoded: true,
        body: imageBuffer.toString('base64'),
    };
}
