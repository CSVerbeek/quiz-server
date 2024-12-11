import path from 'path';
import { Quiz } from './quiz';
import { QuizCreate } from './quizes.controller';
import fs from 'fs';
import { v4 as uuidV4 } from 'uuid';
import { Question, QuestionCreate } from '../questions/question';

export class FileSystemQuizRepository {
  readonly repoDir = path.join(__dirname, '..', 'repos', 'quizes');

  constructor() {
    if (!fs.existsSync(this.repoDir)) {
      fs.mkdirSync(this.repoDir, { recursive: true });
    }
  }

  getAll(): Promise<Quiz[]> {
    return new Promise<Quiz[]>((resolve, reject) => {
      fs.readdir(this.repoDir, (err, files) => {
        console.log('Resolving', files);
        if (err) {
          reject('Error reading quizes');
          return;
        }
        const result: Quiz[] = [];
        files.forEach(fileName => {
          const content = fs.readFileSync(path.join(this.repoDir, fileName), 'utf8');

          const quiz: Quiz = JSON.parse(content);
          result.push(quiz);
        });
        resolve(result);
      });
    });
  }

  getById(quizId: Quiz['id']): Promise<Quiz> {
    console.log('Finding by id', quizId);
    return new Promise<Quiz>((resolve, reject) => {
      fs.readFile(path.join(this.repoDir, quizId), 'utf8', (err, content) => {
        if (err) {
          reject('Not found');
          return;
        }
        const quiz: Quiz = JSON.parse(content);
        resolve(quiz);
      });
    });
  }

  create(quizCreate: QuizCreate): Promise<Quiz> {
    const quiz: Quiz = {
      ...quizCreate,
      id: uuidV4(),
      questions: [],
    };
    return new Promise<Quiz>((resolve, reject) => {
      fs.writeFile(path.join(this.repoDir, quiz.id), JSON.stringify(quiz), 'utf8', err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(quiz);
      });
    });
  }

  async addQuestion(quizId: Quiz['id'], questionCreate: QuestionCreate): Promise<Quiz> {
    const question: Question = {
      ...questionCreate,
      id: uuidV4(),
    };
    const quiz = await this.getById(quizId);
    const updatedQuiz = {
      ...quiz,
      questions: [...quiz.questions, question],
    };
    return new Promise((resolve, reject) => {
      fs.writeFile(path.join(this.repoDir, quizId), JSON.stringify(updatedQuiz), 'utf8', err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(updatedQuiz);
      });
    });
  }
}
