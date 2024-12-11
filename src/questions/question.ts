export type Question = {
  id: string;
  question: string;
  answers: QuestionAnswer[];
};

type QuestionAnswer = {
  answer: string;
  isCorrect: boolean;
};

export type QuestionCreate = Omit<Question, 'id'>;
