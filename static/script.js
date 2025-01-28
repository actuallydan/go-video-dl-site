async function fetchVideoInfo() {
    const videoUrl = document.getElementById('videoUrl').value;
    if (!videoUrl) return;

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

    downloadOptions.innerHTML = '';
    
    // Add audio download option
    const audioButton = createDownloadButton('Download Audio (Best Quality)', 'audio');
    downloadOptions.appendChild(audioButton);

    // Add video download options
    info.formats.forEach(format => {
        const button = createDownloadButton(
            `Download ${format.quality} (${format.ext})`,
            'video',
            format.formatId
        );
        downloadOptions.appendChild(button);
    });

    videoInfo.classList.remove('hidden');
}

function createDownloadButton(text, type, formatId = '') {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'download-button';
    button.onclick = () => downloadMedia(type, formatId);
    return button;
}

async function downloadMedia(type, formatId = '') {
    const videoUrl = document.getElementById('videoUrl').value;
    if (!videoUrl) return;

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
            const error = await response.json();
            throw new Error(error.error);
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
    }
} 