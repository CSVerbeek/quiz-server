import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { QuizesController } from './quizes/quizes.controller';
import { QuizService } from './quizes/quiz.service';
import { FileSystemQuizRepository } from './quizes/file-system-quiz.repository';
import { Question } from './questions/question';

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
  questions: Question[];
  answers: Map<string, string>;
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
app.get('/quiz/:quizid', (req, res) => {
  quizController.findById(req.params.quizid);
});
app.get('/quiz', async (req, res) => {
  const quizes = await quizController.findAll();
  console.log(quizes);
  res.status(200).send(quizes);
});

function shuffleAnswers(questionsOriginal: Question[]): Question[] {
  return questionsOriginal.map(q => ({ ...q, answers: shuffleArr(q.answers) }));
}

function shuffleArr(arrOriginal: Question['answers']): Question['answers'] {
  const arr = [...arrOriginal];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
    if (!roomId) {
      return callback({ success: false, message: 'Room name is required' });
    }

    console.log('Trying to find room', roomId);
    console.log(rooms);
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
  socket.on('startQuiz', async ({ quizId, roomName }, callback) => {
    if (!roomName || roomName.length === 0) {
      return callback({ success: false, message: 'A roomname is required to start a quiz' });
    }
    if (rooms.get(roomName)) {
      return callback({ success: false, message: 'There is already a quiz going on with this room name' });
    }
    if (!quizId || quizId.length === 0) {
      return callback({ success: false, message: 'A quiz is required to start a quiz' });
    }
    const quiz = await quizController.findById(quizId);
    if (!quiz) {
      return callback({ success: false, message: 'Quiz not found' });
    }
    const questions = shuffleAnswers(quiz.questions);

    const roomId = roomName;
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
    console.log(room.answers);

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
      const question = room.questions[room.currentQuestionIndex];
      const questionWithoutAnswers = { ...question, answers: question.answers.map(a => ({ answer: a.answer })) };

      io.to(roomId).emit('nextQuestion', { question: questionWithoutAnswers });
      console.log(`Next question for room ${roomId}: ${question}`);
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
