import { QuestionCreate } from '../questions/question';
import { Quiz } from './quiz';
import { QuizService } from './quiz.service';

export class QuizesController {
  constructor(private quizService: QuizService) {}

  async createQuiz(quiz: QuizCreate) {
    return this.quizService.createQuiz(quiz);
  }

  async addQuestion(quizId: Quiz['id'], questionCreate: QuestionCreate) {
    return this.quizService.addQuestion(quizId, questionCreate);
  }

  async findAll() {
    return this.quizService.findAll();
  }

  async findById(quizId: Quiz['id']) {
    return this.quizService.findById(quizId);
  }
}

export type QuizCreate = Pick<Quiz, 'name'>;
