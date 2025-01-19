import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';
import { ErrorResponse } from './utils/errorResponse';
import userRoutes from './routes/user.routes';
import examRoutes from './routes/exam.routes';
import proctorRoutes from './routes/proctor.routes';
import organisationRoutes from './routes/organisation.routes';
import authRoutes from './routes/auth.routes';
import { initializeWebSocket } from './websockets/websocket';
import http from 'http';
import path from 'path';

const app = express();
const server = http.createServer(app);
const wss = initializeWebSocket(server);

app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

app.use('/routes/organisations', organisationRoutes);
app.use('/routes/users', userRoutes);
app.use('/routes/exams', examRoutes);
app.use('/routes/proctoring', proctorRoutes);
app.use('/routes/auth', authRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Server is running');
});

app.get('/proctor', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../frontend/proctor.html'));
});

app.get('/user', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../frontend/user.html'));
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorResponse = ErrorResponse.handle(err);
  res.status(errorResponse.statusCode).json({ message: errorResponse.message });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { wss, app };