export class NotificationDO implements DurableObject {
  private sessions: WebSocket[] = [];

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/connect' && request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.accept();
      this.sessions.push(server);
      server.addEventListener('close', () => {
        this.sessions = this.sessions.filter(s => s !== server);
      });
      server.addEventListener('error', () => {
        this.sessions = this.sessions.filter(s => s !== server);
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/push' && request.method === 'POST') {
      const msg = await request.text();
      for (const ws of this.sessions) {
        try {
          ws.send(msg);
        } catch {
          // socket already closed, will be cleaned up on next close event
        }
      }
      return new Response('OK');
    }

    return new Response('Not Found', { status: 404 });
  }
}
