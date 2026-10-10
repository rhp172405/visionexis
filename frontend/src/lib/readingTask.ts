export interface MCQ {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface Passage {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  text: string;
  questions: MCQ[];
}

export const PASSAGES: Passage[] = [
  {
    id: "easy-1",
    title: "A Morning in Town",
    difficulty: "easy",
    text: "The sun rose early over the hills. Birds began to sing in the trees. A cool breeze moved through the valley. Children walked to school with their bags. The market opened and people began to buy fresh fruit and vegetables. By midday the town was busy with activity.",
    questions: [
      {
        question: "When did the sun rise?",
        options: ["Early", "Late in the day", "At noon", "At midnight"],
        answerIndex: 0,
      },
      {
        question: "Where did the birds sing?",
        options: ["On the ground", "In the trees", "On the rooftops", "By the river"],
        answerIndex: 1,
      },
      {
        question: "What did people buy at the market?",
        options: ["Clothes and shoes", "Books and pens", "Fresh fruit and vegetables", "Furniture"],
        answerIndex: 2,
      },
    ],
  },
  {
    id: "medium-1",
    title: "The Benefits of Reading",
    difficulty: "medium",
    text: "Reading is one of the most important skills a person can develop. It allows us to access knowledge across all fields of human inquiry. Studies have shown that regular readers have stronger vocabulary, better comprehension, and improved critical thinking skills. The act of reading also exercises working memory, requiring the brain to hold and process information simultaneously. Despite the rise of digital media, research suggests that reading printed text leads to deeper retention compared to skimming online content. Developing a daily reading habit, even for as little as twenty minutes, can produce significant cognitive benefits over time.",
    questions: [
      {
        question: "What does reading exercise, according to the passage?",
        options: ["Physical stamina", "Working memory", "Hand-eye coordination", "Emotional intelligence"],
        answerIndex: 1,
      },
      {
        question: "How long should a daily reading habit be at minimum?",
        options: ["One hour", "Thirty minutes", "Twenty minutes", "Forty-five minutes"],
        answerIndex: 2,
      },
      {
        question: "How does printed text compare to online content?",
        options: ["It is faster to read", "It leads to deeper retention", "It has more information", "It is easier to skim"],
        answerIndex: 1,
      },
    ],
  },
  {
    id: "hard-1",
    title: "Neural Substrates of Reading",
    difficulty: "hard",
    text: "Cognitive neuroscience has illuminated the complex neural substrates underlying reading comprehension. The process involves a hierarchical cascade of perceptual, lexical, and semantic operations, beginning with the extraction of orthographic features from the visual cortex and culminating in the construction of a coherent mental model in prefrontal and temporal regions. Saccadic eye movements, averaging between 200 and 250 milliseconds, enable rapid serial fixation of successive word groups. Regressions — backward saccades to previously fixated regions — occur in approximately 10 to 15 percent of fixations in skilled readers, rising substantially under conditions of increased syntactic ambiguity or unfamiliar lexical items. The dual-route model of reading posits that word recognition proceeds via both a direct lexical route and a phonologically mediated sublexical route, with route dominance modulated by stimulus familiarity and individual reading strategy.",
    questions: [
      {
        question: "What percentage of fixations involve regressions in skilled readers?",
        options: ["5 to 10%", "10 to 15%", "20 to 25%", "30 to 35%"],
        answerIndex: 1,
      },
      {
        question: "How long do saccadic eye movements average?",
        options: ["100–150 ms", "150–200 ms", "200–250 ms", "300–350 ms"],
        answerIndex: 2,
      },
      {
        question: "What are the two routes in the dual-route model?",
        options: [
          "Visual and auditory routes",
          "Direct lexical and phonologically mediated sublexical routes",
          "Perceptual and semantic routes",
          "Fast and slow routes",
        ],
        answerIndex: 1,
      },
    ],
  },
];

export type Difficulty = "easy" | "medium" | "hard";

export function getPassage(difficulty: Difficulty): Passage {
  return PASSAGES.find((p) => p.difficulty === difficulty)!;
}

export function getWordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function computeCognitiveLoadIndex(regressions: number, avgFixationMs: number): number {
  return Math.round(Math.min(100, regressions * 8 + Math.max(0, (avgFixationMs - 200) / 5)));
}

export function cognitiveLoadLabel(index: number): string {
  if (index <= 30) return "Low";
  if (index <= 60) return "Moderate";
  return "High";
}

export function cognitiveLoadColor(index: number): string {
  if (index <= 30) return "bg-emerald-100 text-emerald-700";
  if (index <= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}
