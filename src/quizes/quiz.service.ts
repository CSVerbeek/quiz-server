import { QuestionCreate } from '../questions/question';
import { FileSystemQuizRepository } from './file-system-quiz.repository';
import { Quiz } from './quiz';
import { QuizCreate } from './quizes.controller';

export class QuizService {
  constructor(private quizRepository: FileSystemQuizRepository) {}

  async createQuiz(quiz: QuizCreate): Promise<Quiz> {
    return this.quizRepository.create(quiz);
  }

  async addQuestion(quizId: Quiz['id'], question: QuestionCreate): Promise<Quiz> {
    return this.quizRepository.addQuestion(quizId, question);
  }

  async findAll(): Promise<Quiz[]> {
    return this.quizRepository.getAll();
  }

  async findById(quizId: Quiz['id']) {
    return this.quizRepository.getById(quizId);
  }
}
