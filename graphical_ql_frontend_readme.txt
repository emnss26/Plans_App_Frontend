# GraphicalQL Frontend

This is the frontend application for the GraphicalQL platform, a BIM coordination and model management tool. It interfaces with Autodesk APIs and presents project data interactively to the user.

## Features

- Login with Autodesk OAuth 2.0 (3-legged)
- Project list UI from Autodesk Data API
- Session-managed access and route protection
- Modular layout with Tailwind CSS styling

## Stack

- **Framework**: React + Vite
- **Routing**: React Router
- **Auth**: Autodesk OAuth (via backend)
- **Styling**: Tailwind CSS + Lucide Icons

## Requirements

- Node.js 18+
- Backend URL with valid Autodesk app setup

## Getting Started

### Clone the repository
```bash
git clone https://github.com/emnss26/GraphicalQL_Frontend.git
cd GraphicalQL_Frontend
```

### Install dependencies
```bash
npm install
```

### Environment setup
Create a `.env` file:
```env
VITE_API_BACKEND_BASE_URL=http://localhost:8000
VITE_CLIENT_ID=your_autodesk_client_id
```

### Run the frontend
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Production Build
```bash
npm run build
```
Serve with:
- **IIS Static Hosting** for `dist` folder
- Configure `web.config` for SPA routing

## Deployment Notes
- IIS must rewrite `/api` requests to backend
- Configure HTTPS with SameSite=None cookie support
- Ensure correct reverse proxy headers to backend

## UX Highlights
- Clean, responsive interface
- Loading indicators, error feedback, and transitions
- Tailored UX for model/project data browsing

## License
MIT

---
For feedback or contributions, visit [emnss26](https://github.com/emnss26).
