const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'manojkm78-crypto';
const REPO_NAME = 'Yajat-krishna-games-and-apps';
const ADMIN_EMAIL = 'yajatkrishna24@gmail.com';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.post('/upload', upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'apk', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description, email, fileSize } = req.body;
    
    // Verify email
    if (email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Unauthorized email' });
    }

    if (!name || !req.files.apk) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const apkFile = req.files.apk[0];
    const iconFile = req.files.icon ? req.files.icon[0] : null;

    // Clean filenames
    const apkFilename = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.apk';
    const iconFilename = iconFile ? name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.png' : null;

    // Upload APK
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `apps/${apkFilename}`,
      message: `Upload APK: ${name}`,
      content: apkFile.buffer.toString('base64'),
    });

    // Upload Icon if provided
    if (iconFile) {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: `icons/${iconFilename}`,
        message: `Upload icon: ${name}`,
        content: iconFile.buffer.toString('base64'),
      });
    }

    // Get existing apps
    let appsData = [];
    try {
      const response = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: 'apps/info.json',
      });
      appsData = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
    } catch (e) {
      appsData = [];
    }

    // Add new app
    const newApp = {
      name,
      description: description || '',
      fileSize: fileSize || 'Unknown',
      apkFile: apkFilename,
      iconFile: iconFilename || null,
    };

    appsData.push(newApp);

    // Update info.json
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'apps/info.json',
      message: `Add app: ${name}`,
      content: Buffer.from(JSON.stringify(appsData, null, 2)).toString('base64'),
    });

    res.json({ success: true, message: 'App uploaded successfully!', app: newApp });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});