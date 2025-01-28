package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

type VideoRequest struct {
	URL      string `json:"url"`
	Type     string `json:"type,omitempty"`
	FormatID string `json:"formatId,omitempty"`
}

type VideoFormat struct {
	FormatID string `json:"formatId"`
	Quality  string `json:"quality"`
	Ext      string `json:"ext"`
}

type VideoInfo struct {
	Title    string        `json:"title"`
	Duration string        `json:"duration"`
	Formats  []VideoFormat `json:"formats"`
}

func main() {
	// Serve static files
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Serve index.html at root
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "static/index.html")
			return
		}
		http.NotFound(w, r)
	})

	// API endpoints
	http.HandleFunc("/api/video-info", handleVideoInfo)
	http.HandleFunc("/api/download", handleDownload)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func handleVideoInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req VideoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get video info using yt-dlp
	cmd := exec.Command("yt-dlp", "-J", req.URL)
	output, err := cmd.Output()
	if err != nil {
		http.Error(w, "Failed to get video info", http.StatusInternalServerError)
		return
	}

	// Parse the JSON output
	var rawInfo map[string]interface{}
	if err := json.Unmarshal(output, &rawInfo); err != nil {
		http.Error(w, "Failed to parse video info", http.StatusInternalServerError)
		return
	}

	// Extract relevant information
	info := VideoInfo{
		Title:    rawInfo["title"].(string),
		Duration: fmt.Sprintf("%d:%02d", int(rawInfo["duration"].(float64))/60, int(rawInfo["duration"].(float64))%60),
		Formats:  []VideoFormat{},
	}

	// Extract format information
	formats := rawInfo["formats"].([]interface{})
	for _, f := range formats {
		format := f.(map[string]interface{})
		if format["vcodec"] != "none" && format["acodec"] != "none" {
			info.Formats = append(info.Formats, VideoFormat{
				FormatID: format["format_id"].(string),
				Quality:  format["format_note"].(string),
				Ext:      format["ext"].(string),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req VideoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "youtube-dl-*")
	if err != nil {
		http.Error(w, "Failed to create temporary directory", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tempDir)

	// Prepare yt-dlp command
	args := []string{
		"-o", filepath.Join(tempDir, "%(title)s.%(ext)s"),
	}

	if req.Type == "audio" {
		args = append(args, "-x", "--audio-format", "mp3")
	} else if req.FormatID != "" {
		args = append(args, "-f", req.FormatID)
	}

	args = append(args, req.URL)
	cmd := exec.Command("yt-dlp", args...)

	// Execute the command
	if err := cmd.Run(); err != nil {
		http.Error(w, "Failed to download media", http.StatusInternalServerError)
		return
	}

	// Find the downloaded file
	files, err := os.ReadDir(tempDir)
	if err != nil || len(files) == 0 {
		http.Error(w, "Failed to locate downloaded file", http.StatusInternalServerError)
		return
	}

	filePath := filepath.Join(tempDir, files[0].Name())
	file, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "Failed to open downloaded file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set appropriate headers
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, files[0].Name()))
	w.Header().Set("Content-Type", "application/octet-stream")

	// Stream the file to the client
	io.Copy(w, file)
}
