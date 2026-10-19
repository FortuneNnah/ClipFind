import React, { useEffect, useRef, useState } from "react";
import {
  BiCheckCircle,
  BiCloudUpload,
  BiLink,
  BiMoviePlay,
  BiX,
} from "react-icons/bi";
import "./App.css";

const API_URL = "https://clipfind-backend.onrender.com/api";
const HISTORY_KEY = "clipfind-upload-history";
const FILE_SIZE_LIMIT = 25 * 1024 * 1024;

// One progress bar covers both steps for files AND links:
// 0-50% = getting the clip to the server, 50-100% = AI identifying the movie.
const UPLOAD_SHARE = 50;
const PROCESSING_CAP = 95; // processing creeps toward this until the job finishes

const formatGenre = (genre) => {
  if (Array.isArray(genre)) return genre.join(", ");
  if (typeof genre === "string") return genre;
  return null;
};

const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getPosterUrl = (movie) => {
  for (const key of ["poster_path", "poster"]) {
    if (typeof movie?.[key] === "string" && movie[key].trim()) return movie[key];
  }
  return null;
};

const getStageText = (item, { phase, progress = 0 }) => {
  if (phase === "uploading") return item.isLink ? "Fetching your link..." : "Uploading...";
  if (progress < 70) return "AI is identifying movie...";
  if (progress < 90) return "Analyzing scenes...";
  return "Almost done...";
};

const Upload = () => {
  const fileInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const timers = useRef({});
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState({}); // { phase, progress, error }
  const [results, setResults] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(
    () => () =>
      Object.values(timers.current).forEach((t) => {
        clearInterval(t.tick);
        clearInterval(t.poll);
      }),
    []
  );

  const hasActiveUpload = Object.values(statuses).some(
    (s) => s.phase === "uploading" || s.phase === "processing"
  );
  const pendingFiles = items.filter(
    (i) => !i.isLink && statuses[i.id]?.phase !== "completed"
  );

  /* ---------- history ---------- */

  const saveHistoryItem = (item, movie) => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const entry = {
        id: makeId(),
        originalname: item.name,
        filename: item.name,
        title: movie?.title || item.name,
        year: movie?.year || null,
        director: movie?.director || null,
        type: movie?.type || null,
        genre: formatGenre(movie?.genre),
        poster: getPosterUrl(movie),
        size: item.size,
        uploadedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify([entry, ...(Array.isArray(stored) ? stored : [])])
      );
    } catch (error) {
      console.error("Unable to save upload history:", error);
    }
  };

  /* ---------- status + timer helpers ---------- */

  const setStatus = (id, patch) =>
    setStatuses((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const stopTimer = (id, kind) => {
    clearInterval(timers.current[id]?.[kind]);
    if (timers.current[id]) delete timers.current[id][kind];
  };

  const startTimer = (id, kind, fn, ms) => {
    stopTimer(id, kind);
    timers.current[id] = { ...timers.current[id], [kind]: setInterval(fn, ms) };
  };

  // The server gives no progress while it fetches a link or runs the AI,
  // so the bar eases toward `cap` to show work is happening.
  const creepProgress = (id, cap) =>
    startTimer(
      id,
      "tick",
      () =>
        setStatuses((prev) => {
          const s = prev[id];
          if (!s) return prev;
          const next = s.progress + Math.max(0.3, (cap - s.progress) * 0.06);
          return { ...prev, [id]: { ...s, progress: Math.min(cap, next) } };
        }),
      250
    );

  const fail = (id, error) => {
    stopTimer(id, "tick");
    stopTimer(id, "poll");
    setStatus(id, { phase: "error", error });
  };

  /* ---------- job polling ---------- */

  const beginProcessing = (item, jobId) => {
    setStatus(item.id, { phase: "processing", progress: UPLOAD_SHARE, error: null });
    creepProgress(item.id, PROCESSING_CAP);

    // Poll the backend every 3 seconds
    startTimer(
      item.id,
      "poll",
      async () => {
        try {
          const res = await fetch(`${API_URL}/job/${jobId}`);
          const data = await res.json();

          if (data.status === "completed") {
            stopTimer(item.id, "tick");
            stopTimer(item.id, "poll");
            setResults((prev) => ({ ...prev, [item.id]: data.result }));
            setStatus(item.id, { phase: "completed", progress: 100 });
            saveHistoryItem(item, data.result);
          } else if (data.status === "failed") {
            fail(item.id, "Unable to identify movie.");
          }
        } catch (error) {
          console.error("Polling error:", error);
          fail(item.id, "Unable to check processing status");
        }
      },
      3000
    );
  };

  /* ---------- adding clips ---------- */

  const handleFiles = (selectedFiles) => {
    const all = Array.from(selectedFiles);
    const videos = all.filter((f) => f.type.startsWith("video/"));
    setNotice(videos.length < all.length ? "Only video files can be added." : "");
    setItems((prev) => [
      ...prev,
      ...videos.map((file) => ({
        id: makeId(),
        name: file.name,
        size: file.size,
        isLink: false,
        file,
      })),
    ]);
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (id) => {
    stopTimer(id, "tick");
    stopTimer(id, "poll");
    setItems((prev) => prev.filter((i) => i.id !== id));
    setStatuses(({ [id]: _s, ...rest }) => rest);
    setResults(({ [id]: _r, ...rest }) => rest);
  };

  /* ---------- link upload ---------- */

  const handleUploadLink = async () => {
    if (hasActiveUpload) return;

    const videoUrl = linkInputRef.current?.value.trim();
    if (!videoUrl) return;

    try {
      new URL(videoUrl);
    } catch {
      setNotice("Enter a full video link, starting with https://");
      return;
    }

    setNotice("");
    const item = { id: makeId(), name: videoUrl, size: 0, isLink: true, file: null };
    setItems((prev) => [...prev, item]);
    setStatus(item.id, { phase: "uploading", progress: 0, error: null });
    creepProgress(item.id, UPLOAD_SHARE - 5); // hold just short of the upload share until the server replies

    try {
      const response = await fetch(`${API_URL}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.jobId) {
        throw new Error(data.message || data.error || "Unable to submit video URL.");
      }

      if (linkInputRef.current) linkInputRef.current.value = "";
      beginProcessing(item, data.jobId);
    } catch (error) {
      console.error("Link upload failed:", error);
      fail(item.id, error.message);
    }
  };

  /* ---------- file upload ---------- */

  const uploadSingle = (item) =>
    new Promise((resolve) => {
      setStatus(item.id, { phase: "uploading", progress: 0, error: null });

      const form = new FormData();
      form.append("video", item.file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/upload`);

      // Real upload progress fills the first half of the bar
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setStatus(item.id, { progress: (event.loaded / event.total) * UPLOAD_SHARE });
        }
      };

      xhr.onload = () => {
        if (xhr.status !== 202) {
          fail(item.id, `Upload failed (${xhr.status})`);
          return resolve();
        }

        let data = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          fail(item.id, "Invalid server response");
          return resolve();
        }

        if (data.jobId) beginProcessing(item, data.jobId);
        else fail(item.id, "No job ID returned");
        resolve();
      };

      xhr.onerror = () => {
        fail(item.id, "Upload error");
        resolve();
      };

      xhr.send(form);
    });

  const handleUploadAll = async () => {
    for (const item of pendingFiles) {
      if (item.size > FILE_SIZE_LIMIT) {
        fail(item.id, "File too large");
        continue;
      }
      await uploadSingle(item);
    }
  };

  /* ---------- render ---------- */

  return (
    <main className="upload-container">
      <div className="heading">
        <p className="aitext">AI scene recognition</p>
        <h1>Found a scene?</h1>
        <h2>We'll find the movie.</h2>
        <p>
          Upload a movie clip or paste a link and our AI names the film, with
          its year, director and genre.
        </p>
      </div>

      {/* Drop zone, styled as a strip of film */}
      <div
        className={`upload-area ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-area-inner">
          <div className="drag-icon" aria-hidden="true">
            <BiCloudUpload />
          </div>

          <p className="dragtxt">Drop a clip here</p>

          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            id="fileInput"
            multiple
            onChange={handleInputChange}
          />

          <button
            onClick={() => !hasActiveUpload && fileInputRef.current?.click()}
            type="button"
            className="uploadBtn"
            id="uploadBtn"
          >
            Browse files
          </button>

          <div className="divider">or paste a link</div>

          <div className="linkInput">
            <BiLink className="link-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="https://..."
              aria-label="Video link"
              ref={linkInputRef}
              onKeyDown={(e) => e.key === "Enter" && handleUploadLink()}
            />
            <button
              onClick={handleUploadLink}
              className="uploadBtn2"
              type="button"
              id="uploadBtn2"
              disabled={hasActiveUpload}
            >
              Find movie
            </button>
          </div>

          {notice && <p className="notice" role="alert">{notice}</p>}

          <p className="note">Video files only, Max 25MB. </p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="file-list">
          <ul className="file-items-container">
            {items.map((item) => {
              const status = statuses[item.id] || { phase: "idle", progress: 0 };
              const isActive = status.phase === "uploading" || status.phase === "processing";
              const isOverLimit = !item.isLink && item.size > FILE_SIZE_LIMIT;
              const percent = Math.round(status.progress || 0);

              return (
                <li key={item.id} className={`file-item ${isOverLimit ? "error" : ""}`}>
                  <div className="file-item-icon" aria-hidden="true">
                    {item.isLink ? <BiLink /> : <BiMoviePlay />}
                  </div>

                  <div className="file-item-details">
                    <span className="file-name" title={item.name}>{item.name}</span>

                    <span className="file-size">
                      {isOverLimit && <span className="error-badge">Over 25MB limit</span>}
                      <span className="file-size-value">
                        {item.isLink ? "Video link" : formatSize(item.size)}
                      </span>
                    </span>

                    <div className="upload-status" aria-live="polite">
                      {isActive && (
                        <span className={`status ${status.phase}`}>
                          {getStageText(item, status)}
                        </span>
                      )}
                      {status.phase === "completed" && (
                        <span className="status uploaded">
                          <BiCheckCircle /> Movie identified
                        </span>
                      )}
                      {status.phase === "error" && (
                        <span className="status error">{status.error}</span>
                      )}
                    </div>

                    {/* Same bar for files and links, from upload through processing */}
                    {isActive && (
                      <div className="progress-wrapper">
                        <div
                          className={`progress-bar ${status.phase}`}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={percent}
                        >
                          <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="progress-label">{percent}%</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => handleRemove(item.id)}
                    title="Remove"
                    aria-label={`Remove ${item.name}`}
                  >
                    <BiX />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="file-list-header">
            <h3>
              {items.length} clip{items.length !== 1 ? "s" : ""} added
            </h3>
            <button
              type="button"
              className="uploadAllBtn"
              onClick={handleUploadAll}
              disabled={hasActiveUpload || pendingFiles.length === 0}
            >
              {hasActiveUpload ? "Processing..." : "Upload files"}
            </button>
          </div>

          {Object.keys(results).length > 0 && (
            <section className="upload-result-container">
              <div className="result-header">
                <h3>Movie identified</h3>
                <p>Here's what we found from your clip.</p>
              </div>

              <div className="movie-results-list">
                {items
                  .filter((item) => results[item.id])
                  .map((item) => {
                    const movie = results[item.id];
                    const posterUrl = getPosterUrl(movie);
                    const genre = formatGenre(movie.genre);

                    return (
                      <article className="movie-result" key={item.id}>
                        <div className="movie-result-icon">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={movie.title ? `${movie.title} poster` : "Movie poster"}
                            />
                          ) : (
                            <BiMoviePlay aria-hidden="true" />
                          )}
                        </div>

                        <div className="movie-result-info">
                          <h3>{movie.title}</h3>

                          {(movie.year || movie.type || genre || movie.director) && (
                            <div className="movie-chips">
                              {movie.year && <span className="chip"><strong>Year:</strong> {movie.year}</span>}
                              {movie.type && <span className="chip"><strong>Type:</strong> {movie.type}</span>}
                              {genre && <span className="chip"><strong>Genre:</strong> {genre}</span>}
                              {movie.director && <span className="chip"><strong>Directed by</strong> {movie.director}</span>}
                            </div>
                          )}
{/* 
                          {movie.director && (
                            <p>
                              <strong>Directed by</strong> {movie.director}
                            </p>
                          )} */}
                        </div>
                      </article>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
};

export default Upload;