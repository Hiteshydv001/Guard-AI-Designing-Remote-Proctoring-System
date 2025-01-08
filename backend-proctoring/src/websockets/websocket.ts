import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

interface Client {
  ws: WebSocket;
  role: 'proctor' | 'user';
  userId: string;
  examId: string;
}

const clients: Client[] = [];

const initializeWebSocket = (server: http.Server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      const msg = data.toString();
      try {
        const parsed = JSON.parse(msg);
        console.log('WebSocket message:', parsed);

        if (parsed.type === 'join') {
          // Add client to the list
          clients.push({
            ws,
            role: parsed.role,
            userId: parsed.userId,
            examId: parsed.examId,
          });
          console.log(`Client joined: ${parsed.role} - ${parsed.userId}`);
        } else if (parsed.type === 'message') {
          // Relay message to the other side (proctor -> user or user -> proctor)
          const targetRole = parsed.role === 'proctor' ? 'user' : 'proctor';
          const targetClients = clients.filter(
            (client) => client.role === targetRole && client.examId === parsed.examId
          );

          targetClients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify({
                type: 'message',
                from: parsed.role,
                userId: parsed.userId,
                message: parsed.message,
              }));
            }
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from the list when they disconnect
      const index = clients.findIndex((client) => client.ws === ws);
      if (index !== -1) {
        console.log(`Client disconnected: ${clients[index].role} - ${clients[index].userId}`);
        clients.splice(index, 1);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
};

export { initializeWebSocket };