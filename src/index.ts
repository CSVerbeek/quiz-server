import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { QuizesController } from './quizes/quizes.controller';
import { QuizService } from './quizes/quiz.service';
import { FileSystemQuizRepository } from './quizes/file-system-quiz.repository';

const app = express();
app.use(express.json());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for testing; restrict this in production
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

interface Player {
  id: string;
  name: string;
}

interface Room {
  id: string;
  players: Player[];
  currentQuestionIndex: number;
  questions: string[]; // List of questions for the quiz
  answers: Map<string, string>; // Map playerId -> Answer
}

const rooms: Map<string, Room> = new Map();

// Serve a welcome message
app.get('/', (req, res) => {
  res.send('Quiz Server is Running!');
});

const quizController = new QuizesController(new QuizService(new FileSystemQuizRepository()));
app.post('/quiz', (req, res) => {
  quizController.createQuiz(req.body).then(quiz => {
    res.status(201).send(quiz);
  });
});
app.post('/question', (req, res) => {
  const { quizId, question } = req.body;
  quizController.addQuestion(quizId, question).then(quiz => {
    res.status(201).send(quiz);
  });
});

/**
 * Socket.IO logic for managing quiz game
 */
io.on('connection', socket => {
  console.log(`New connection: ${socket.id}`);

  // Player joins a room
  socket.on('joinRoom', ({ playerName, roomId }, callback) => {
    if (!playerName) {
      return callback({ success: false, message: 'Player name is required' });
    }

    let room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, message: 'Room does not exist' });
    }

    const player: Player = { id: socket.id, name: playerName };
    room.players.push(player);
    rooms.set(roomId, room);

    socket.join(roomId);
    io.to(roomId).emit('playerJoined', { playerName, players: room.players });
    console.log(`${playerName} joined room ${roomId}`);

    return callback({ success: true, message: 'Joined the room successfully', roomId });
  });

  // Start a new quiz (create a new room)
  socket.on('startQuiz', ({ questions }, callback) => {
    if (!questions || questions.length === 0) {
      return callback({ success: false, message: 'Questions are required to start a quiz' });
    }

    const roomId = uuidv4();
    const newRoom: Room = {
      id: roomId,
      players: [],
      currentQuestionIndex: 0,
      questions,
      answers: new Map(),
    };

    rooms.set(roomId, newRoom);
    console.log(`Quiz started with room ID: ${roomId}`);

    return callback({ success: true, message: 'Quiz started successfully', roomId });
  });

  // Submit an answer
  socket.on('submitAnswer', ({ roomId, answer }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }

    room.answers.set(socket.id, answer);
    rooms.set(roomId, room);

    console.log(`Player ${socket.id} submitted answer: ${answer} for room ${roomId}`);

    return callback({ success: true, message: 'Answer submitted successfully' });
  });

  // Proceed to next question
  socket.on('nextQuestion', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }

    room.currentQuestionIndex += 1;
    if (room.currentQuestionIndex >= room.questions.length) {
      io.to(roomId).emit('quizEnded', { message: 'Quiz has ended!', answers: Array.from(room.answers.entries()) });
      rooms.delete(roomId);
      console.log(`Quiz ended for room ${roomId}`);
    } else {
      io.to(roomId).emit('nextQuestion', { question: room.questions[room.currentQuestionIndex] });
      console.log(`Next question for room ${roomId}: ${room.questions[room.currentQuestionIndex]}`);
    }
    return callback({ success: true });
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    rooms.forEach((room, roomId) => {
      room.players = room.players.filter(player => player.id !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} has been deleted due to inactivity`);
      } else {
        io.to(roomId).emit('playerLeft', { playerId: socket.id, players: room.players });
      }
    });
  });
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
