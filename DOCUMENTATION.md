# AvenApp Documentation

## Overview
AvenApp is a real-time chat application featuring user profiles, private messaging, public channels, and admin capabilities. It is built with a Node.js backend and a Vanilla JavaScript frontend.

## Technology Stack
- **Backend**: Node.js, Express
- **Database**: Turso (LibSQL) - Compatible with SQLite
- **Real-time Communication**: Socket.io
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript
- **Deployment**: Configurable for standard Node.js environments

## Project Structure
- **/config**: Database configuration and connection (`db.js`).
- **/controllers**: Business logic for different features (Auth, Users, Messages, Channels).
- **/models**: Database schema definitions (`schema.js`).
- **/public**: Static files (HTML, CSS, JS, images).
  - `script.js`: Main frontend logic.
  - `admin.js`: Admin panel logic.
  - `login.js`: Authentication logic.
- **/routes**: API route definitions mapping to controllers.
- **/sockets**: Socket.io event handlers (`socketManager.js`).
- `server.js`: Application entry point.

## Database Schema
The application uses the following primary tables:

- **users**: Stores user credentials, profiles, and flags (is_admin, is_verified, is_premium).
- **messages**: Chat messages (text, image, audio) with references to sender/receiver/channel.
- **channels**: Public or private channels.
- **channel_members**: Membership mapping for channels.
- **contacts**: List of contacts for each user.
- **reports**: User reports for admin review.
- **love_notes**: Special feature for admin-to-user messages.

## Key Features
1.  **Authentication**: Register/Login with encrypted passwords.
2.  **Real-time Chat**: Instant messaging using WebSockets.
3.  **Multimedia**: Support for images, audio messages, and emojis.
4.  **Channels**: Public and private channels with invitation links.
5.  **Admin Panel**:
    - Manage users (verify, premium status).
    - View statistics (growth charts).
    - Review reports.
6.  **Profile Customization**: Avatars, bios, and nicknames.

## Setup & Running
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**: Create a `.env` file with:
    - `TURSO_DATABASE_URL`
    - `TURSO_AUTH_TOKEN`
    - `PORT` (optional)
3.  **Start Server**:
    ```bash
    npm run dev  # Development
    node server.js # Production
    ```

## API Overview
- **/api/auth**: Registration and Login.
- **/api/me**: Current user session data.
- **/api/users**: User management.
- **/api/messages**: Message history and operations.
- **/api/channels**: Channel creation and management.
- **/api/admin**: Admin-only endpoints.
