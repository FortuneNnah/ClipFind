# ClipFind

ClipFind helps anyone figure out which movie a scene comes from. Users upload a video clip or paste a link from social media, and the app returns the movie title, release year, director, genre, and poster. It solves the everyday problem of watching a clip online and not knowing what film it is.

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/FortuneNnah/ClipFInd
cd ClipFInd
```

2. **Install frontend dependencies**

```bash
npm install
```

3. **Install backend dependencies**

```bash
cd server
npm install
cd ..
```

4. **Set up environment variables**

Create a `.env` file inside `server/`:

```bash
# server/.env
GEMINI_API_KEY=your_gemini_key
TMDB_API_KEY=your_tmdb_key
MONGO_URI=your_mongodb_uri
RAPIDAPI_KEY=your_rapidapi_key
PORT=4000
```

5. **Run the backend**

```bash
cd server
npm start
```

The backend runs on `http://localhost:4000`.

6. **Run the frontend**

In a new terminal, from the project root:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Usage

Open the app in your browser, paste a video URL or click **Browse Files**, then click **Upload**. The app shows upload progress, AI processing status, and the final movie result. Completed matches are saved to local storage and can be viewed on the **History** page.

You can also interact with the backend directly:

```bash
curl -F "video=@clip.mp4" http://localhost:4000/api/upload
```

```bash
curl -X POST http://localhost:4000/api/upload-url \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

```bash
curl http://localhost:4000/api/job/<jobId>
```

## Features

- **Video upload**: drag and drop or browse files, with a 25 MB limit per file.
- **Social link support**: paste a YouTube, TikTok, or Twitter/X URL and let the backend handle it.
- **AI movie identification**: Google Gemini analyzes the video and returns the best movie match.
- **Metadata enrichment**: results are enhanced with posters, genres, and media type from TMDB.
- **Async job queue**: each upload gets a job ID, so the frontend can poll for results without hanging.
- **Upload history**: completed results are stored in the browser for quick review.
- **Responsive UI**: clean interface that works on desktop and mobile.

## Technologies Used

| Technology | Purpose | Link |
|---|---|---|
| React | Frontend UI | https://react.dev |
| Vite | Frontend build tool | https://vite.dev |
| TypeScript | Type definitions for React | https://www.typescriptlang.org |
| Node.js | Backend runtime | https://nodejs.org |
| Express | Backend framework | https://expressjs.com |
| MongoDB | Job and result storage | https://www.mongodb.com |
| Mongoose | MongoDB object modeling | https://mongoosejs.com |
| Multer | File upload handling | https://github.com/expressjs/multer |
| Fluent FFmpeg | Video metadata and processing | https://github.com/fluent-ffmpeg/node-fluent-ffmpeg |
| Google Gemini API | AI video identification | https://ai.google.dev |
| TMDB API | Movie metadata and posters | https://www.themoviedb.org |
| yt-dlp | Social video downloading | https://github.com/yt-dlp/yt-dlp |
| RapidAPI | TikTok video proxy | https://rapidapi.com |

## API Documentation

Authentication is not required. API keys are kept server-side only.

#### GET /

**Description**: Health check for the backend.

**Response**:

```json
{
  "status": "ok",
  "message": "ClipFind Backend is running!"
}
```

#### POST /api/upload

**Description**: Upload a local video file and start background AI identification.

**Request**: `multipart/form-data` with a `video` field. Clips must be 3 minutes or shorter.

**Response**:

```json
{
  "message": "Processing started",
  "jobId": "64b1234567890abcdef12345"
}
```

**Errors**:

- 400: Missing file or clip exceeds 3 minutes.
- 502: Server failed to start processing.

#### POST /api/upload-url

**Description**: Submit a public video URL. YouTube links are sent straight to Gemini. TikTok and Twitter/X links are downloaded first, then analyzed.

**Request**:

```json
{
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response**:

```json
{
  "message": "URL processing started",
  "jobId": "64b1234567890abcdef12345"
}
```

**Errors**:

- 400: Missing or invalid URL.
- 500: Failed to initiate URL processing.

#### GET /api/job/:id

**Description**: Check the status of an identification job. Poll this endpoint every few seconds until the status is `completed` or `failed`.

**Response (processing)**:

```json
{
  "_id": "64b1234567890abcdef12345",
  "status": "processing",
  "result": null,
  "createdAt": "2026-07-24T15:44:52.130Z"
}
```

**Response (completed)**:

```json
{
  "_id": "64b1234567890abcdef12345",
  "status": "completed",
  "result": {
    "title": "Inception",
    "year": "2010",
    "director": "Christopher Nolan",
    "poster_path": "https://image.tmdb.org/t/p/w500/...",
    "type": "movie",
    "genre": ["Action", "Science Fiction", "Adventure"]
  },
  "createdAt": "2026-07-24T15:44:52.130Z"
}
```

**Response (failed)**:

```json
{
  "_id": "64b1234567890abcdef12345",
  "status": "failed",
  "result": {
    "error": "Could not extract video from the provided link."
  },
  "createdAt": "2026-07-24T15:44:52.130Z"
}
```

**Errors**:

- 404: Job ID does not exist.
- 500: Database retrieval failure.

#### POST /api/upload-multiple

**Description**: Upload up to 50 video files at once. This endpoint stores files only and does not run AI identification.

**Request**: `multipart/form-data` with a `videos` field.

**Response**:

```json
{
  "success": true,
  "files": [
    {
      "filename": "1718555123456-video1.mp4",
      "path": "/uploads/1718555123456-video1.mp4",
      "originalname": "video1.mp4"
    }
  ]
}
```

**Errors**:

- 400: No files uploaded.

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `TMDB_API_KEY` | The Movie Database API key | `abc123...` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster...` |
| `RAPIDAPI_KEY` | RapidAPI key for TikTok proxy | `a1b2c3...` |
| `PORT` | Backend port | `4000` |

## Contributing

Contributions are welcome. Fork the repo, create a feature branch, make your changes, and open a pull request. If you find a bug or have an idea, open an issue so we can discuss it.

## Author Info

Built by Fortune Nnah

- GitHub: https://github.com/FortuneNnah

## Badges

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)

[![Readme was generated by Dokugen](https://img.shields.io/badge/Readme%20was%20generated%20by-Dokugen-brightgreen)](https://dokugen.samueltuoyo.com)]