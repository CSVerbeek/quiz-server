import { Question } from "../questions/question";

export type Quiz = {
  id: string;
  name: string;
  questions: Question[];
};