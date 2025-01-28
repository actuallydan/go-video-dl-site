async function fetchVideoInfo() {
    const videoUrl = document.getElementById('videoUrl').value;
    const button = document.querySelector('.input-container button');
    if (!videoUrl) return;

    // Store original button text and disable button
    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = '<div class="spinner"></div>';

    try {
        const response = await fetch('/api/video-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        displayVideoInfo(data);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Restore button state
        button.disabled = false;
        button.textContent = originalText;
    }
}

function displayVideoInfo(info) {
    const videoInfo = document.getElementById('videoInfo');
    const videoDetails = document.getElementById('videoDetails');
    const downloadOptions = document.getElementById('downloadOptions');

    videoDetails.innerHTML = `
        <h2>${info.title}</h2>
        <p>Duration: ${info.duration}</p>
    `;

    downloadOptions.innerHTML = `
        <div class="download-column">
            <h3>Audio</h3>
            <div id="audioOptions"></div>
        </div>
        <div class="download-column">
            <h3>Video</h3>
            <div id="videoOptions"></div>
        </div>
    `;
    
    // Add audio download option
    const audioButton = createDownloadButton('Download Audio (Best Quality)', 'audio');
    document.getElementById('audioOptions').appendChild(audioButton);

    // Add video download options
    info.formats.forEach(format => {
        const button = createDownloadButton(
            `Download ${format.quality} (${format.ext})`,
            'video',
            format.formatId
        );
        document.getElementById('videoOptions').appendChild(button);
    });

    videoInfo.classList.remove('hidden');
}

function createDownloadButton(text, type, formatId = '') {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'download-button';
    
    // Create a unique ID for the button based on type and formatId
    button.id = `download-${type}-${formatId || 'audio'}`;
    
    button.onclick = () => downloadMedia(type, formatId);
    return button;
}

async function downloadMedia(type, formatId = '') {
    const videoUrl = document.getElementById('videoUrl').value;
    if (!videoUrl) return;

    // Find the clicked button by its unique ID
    const buttonId = `download-${type}-${formatId || 'audio'}`;
    const clickedButton = document.getElementById(buttonId);
    
    if (!clickedButton) return;

    // Disable the button and show loading state
    const originalText = clickedButton.textContent;
    clickedButton.disabled = true;
    clickedButton.innerHTML = '<div class="spinner"></div> Downloading...';

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: videoUrl,
                type: type,
                formatId: formatId
            }),
        });

        if (!response.ok) {
            // Try to parse as JSON first, fall back to text if that fails
            const errorText = await response.text();
            let errorMessage;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error;
            } catch {
                errorMessage = errorText;
            }
            throw new Error(errorMessage);
        }

        // Get filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        const filename = disposition.split('filename=')[1].replace(/"/g, '');

        // Create blob from response and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Restore button state
        clickedButton.disabled = false;
        clickedButton.textContent = originalText;
    }
} 