# Setup Guide for Dropbox Clone

## Quick Start

### 1. Prerequisites
Make sure you have installed:
- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- AWS account with S3 access
- Git

### 2. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/nice-philip/philip-box.git
cd philip-box

# Install dependencies
npm install
cd client && npm install && cd ..
```

### 3. Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=8080
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/dropbox-clone

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-dropbox-clone-bucket

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 4. AWS S3 Setup

1. **Create S3 Bucket:**
   - Go to AWS S3 Console
   - Create a new bucket (e.g., `your-dropbox-clone-bucket`)
   - Configure bucket permissions for your use case

2. **Create IAM User:**
   - Go to AWS IAM Console
   - Create a new user with programmatic access
   - Attach the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-dropbox-clone-bucket",
                "arn:aws:s3:::your-dropbox-clone-bucket/*"
            ]
        }
    ]
}
```

3. **Get Access Keys:**
   - Copy the Access Key ID and Secret Access Key
   - Add them to your `.env` file

### 5. MongoDB Setup

#### Option A: Local MongoDB
```bash
# Install MongoDB (if not already installed)
# On Windows: Download from https://www.mongodb.com/try/download/community
# On macOS: brew install mongodb/brew/mongodb-community
# On Ubuntu: sudo apt install mongodb

# Start MongoDB
mongod
```

#### Option B: MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/atlas
2. Create a free account
3. Create a new cluster
4. Get the connection string
5. Update `MONGODB_URI` in `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dropbox-clone?retryWrites=true&w=majority
   ```

### 6. Start the Application

```bash
# Start the backend server
npm run dev

# In another terminal, start the frontend (optional for development)
npm run client
```

The application will be available at:
- Backend API: http://localhost:8080
- Frontend: http://localhost:8080 (served by backend)

### 7. First Steps

1. Open http://localhost:8080 in your browser
2. Click "회원가입" (Register) to create a new account
3. Enter your name, email, and password
4. Start uploading files!

## Deployment

### Render.com Deployment

1. **Prepare for deployment:**
   - Push your code to GitHub
   - Create a Render.com account

2. **Create a new Web Service:**
   - Connect your GitHub repository
   - Choose "Web Service"
   - Configure build and start commands:
     - Build Command: `npm install`
     - Start Command: `npm start`

3. **Set Environment Variables:**
   Add all the environment variables from your `.env` file in the Render dashboard.

4. **Deploy:**
   - Render will automatically deploy your application
   - Your app will be available at the provided URL

### Environment Variables for Production

Make sure to set these environment variables in your production environment:

```env
NODE_ENV=production
PORT=8080
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=your-aws-region
S3_BUCKET_NAME=your-s3-bucket
CORS_ORIGIN=https://your-domain.com
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   ```
   Error: Failed to connect to MongoDB
   ```
   - Check if MongoDB is running
   - Verify connection string in `.env`
   - For Atlas, check network access and database user permissions

2. **AWS S3 Upload Error:**
   ```
   Error: Access Denied
   ```
   - Verify AWS credentials
   - Check S3 bucket permissions
   - Ensure IAM user has correct policies

3. **Port Already in Use:**
   ```
   Error: Port 8080 is already in use
   ```
   - Change the PORT in `.env` file
   - Or kill the process using the port

4. **JWT Secret Missing:**
   ```
   Error: JWT secret is required
   ```
   - Make sure JWT_SECRET is set in `.env`
   - Use a strong, random string

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## Development Tips

1. **Use nodemon for development:**
   ```bash
   npm run dev
   ```

2. **Check logs for errors:**
   ```bash
   tail -f logs/app.log
   ```

3. **Test API endpoints:**
   Use tools like Postman or curl to test API endpoints at `http://localhost:8080/api/`

4. **Monitor database:**
   Use MongoDB Compass or similar tools to view your database

## Security Notes

- Never commit `.env` file to version control
- Use strong passwords for MongoDB and AWS
- Enable HTTPS in production
- Regularly update dependencies
- Use environment-specific configurations

## Support

If you need help:
1. Check this setup guide
2. Look at the main README.md
3. Create an issue on GitHub
4. Check the troubleshooting section

Happy coding! 🚀 