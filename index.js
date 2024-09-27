const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = 3000;

// To parse JSON in the request body
app.use(express.json());

// In-memory storage for notifications
const notifications = {};
let clients = [];

// 1. Send Notification API
app.post('/api/notifications/send', (req, res) => {
    const { target, userId, message, source, timestamp } = req.body;

    // If target is a specific user, store the notification for that user
    if (target === 'specific' && userId) {
        if (!notifications[userId]) {
            notifications[userId] = [];
        }
        notifications[userId].push({
            message,
            status: 'unread',
            timestamp
        });

        // Send real-time notification to the specific user
        sendRealTimeNotification({ message, timestamp }, userId);

        return res.status(200).send({ status: 'Notification sent to user ' + userId });
    }

    // If target is all users, send notification to all
    if (target === 'all_users') {
        Object.keys(notifications).forEach(userId => {
            notifications[userId].push({
                message,
                status: 'unread',
                timestamp
            });
        });

        // Broadcast the notification to all connected clients
        sendRealTimeNotification({ message, timestamp });

        return res.status(200).send({ status: 'Notification broadcasted to all users' });
    }

    return res.status(400).send({ status: 'Invalid target or missing userId' });
});

// 2. Fetch Notifications API
app.get('/api/notifications/:userId', (req, res) => {
    const userId = req.params.userId;
    const userNotifications = notifications[userId] || [];
    res.status(200).send(userNotifications);
});

// 3. Mark Notifications as Read API
app.post('/api/notifications/read', (req, res) => {
    const { userId, notificationIds } = req.body;
    if (notifications[userId]) {
        notifications[userId].forEach(notification => {
            if (notificationIds.includes(notification.id)) {
                notification.status = 'read';
            }
        });
    }
    res.status(200).send({ status: 'Notifications marked as read' });
});

// 4. WebSocket Setup for Real-Time Notifications
const wss = new WebSocket.Server({ port: 8080 });

// Function to send real-time notifications via WebSocket
function sendRealTimeNotification(message, userId = null) {
    if (userId) {
        const client = clients.find(c => c.userId === userId);
        if (client) client.ws.send(JSON.stringify(message));
    } else {
        // Broadcast to all connected clients
        clients.forEach(client => client.ws.send(JSON.stringify(message)));
    }
}

// WebSocket Connection handler
wss.on('connection', (ws, req) => {
    const userId = req.url.split('/').pop();
    clients.push({ ws, userId });

    ws.on('close', () => {
        clients = clients.filter(c => c.ws !== ws);
    });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
